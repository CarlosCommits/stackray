import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, normalize, relative, resolve, sep } from "node:path";

import ts from "typescript";
import { parse as parseYaml } from "yaml";

const DEFAULT_TEMPLATE_PATHS = [
  "railway-template.json",
  "railway-template.yaml",
  "railway-template.yml",
  ".railway/template.json",
  ".railway/template.yaml",
  ".railway/template.yml",
] as const;

const EXPECTED_SERVICES = ["Stackray-website", "worker-http", "worker-intel", "worker-browser"] as const;
const EXPECTED_WORKER_ROLES = {
  "worker-http": "http",
  "worker-intel": "intel",
  "worker-browser": "browser",
} as const;
const EXPECTED_ENCRYPTION_KEY_GENERATOR = '${{secret(64, "abcdef0123456789")}}';
const EXPECTED_ENCRYPTION_KEY_REFERENCE = "${{Stackray-website.STACKRAY_ENCRYPTION_KEY}}";
const WORKER_DOCKERFILE_PATH = "worker/Dockerfile";
const WORKER_ENTRYPOINT_PATH = "worker/start.ts";

type TemplateService = {
  name: string;
  value: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseTemplate(path: string) {
  const contents = readFileSync(path, "utf8");
  const extension = extname(path).toLowerCase();

  if (extension === ".json") {
    return JSON.parse(contents);
  }

  if (extension === ".yaml" || extension === ".yml") {
    return parseYaml(contents);
  }

  throw new Error(`Unsupported Railway template extension for ${path}.`);
}

function namedService(name: string, value: unknown): TemplateService | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    name: asString(value.name) ?? name,
    value,
  };
}

function extractServices(template: unknown): TemplateService[] {
  if (!isRecord(template)) {
    throw new Error("Railway template must parse to an object.");
  }

  const containers = [
    template.services,
    getRecord(template.template).services,
    getRecord(template.project).services,
  ].filter((value) => value !== undefined);

  const services: TemplateService[] = [];

  for (const container of containers) {
    if (Array.isArray(container)) {
      services.push(...container.flatMap((entry) => {
        const service = namedService(asString(getRecord(entry).name) ?? "", entry);
        return service ? [service] : [];
      }));
      continue;
    }

    if (isRecord(container)) {
      for (const [name, value] of Object.entries(container)) {
        const service = namedService(name, value);
        if (service) {
          services.push(service);
        }
      }
    }
  }

  if (services.length === 0) {
    throw new Error("Railway template must define services as an array or object.");
  }

  return services;
}

function getStartCommand(service: Record<string, unknown>) {
  const deploy = getRecord(service.deploy);
  return asString(deploy.startCommand)
    ?? asString(deploy.command)
    ?? asString(service.startCommand)
    ?? asString(service.command);
}

function getBuildValue(service: Record<string, unknown>, key: string) {
  const build = getRecord(service.build);
  const deployBuild = getRecord(getRecord(service.deploy).build);
  return asString(build[key]) ?? asString(deployBuild[key]) ?? asString(service[key]);
}

function getVariableValueFromRecord(record: Record<string, unknown>, key: string): string | null {
  const directValue = asString(record[key]);

  if (directValue) {
    return directValue;
  }

  const nestedValue = getRecord(record[key]);
  return asString(nestedValue.value) ?? asString(nestedValue.defaultValue);
}

function getVariableValueFromArray(entries: unknown[], key: string): string | null {
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const name = asString(entry.name) ?? asString(entry.key);

    if (name === key) {
      return asString(entry.value);
    }
  }

  return null;
}

function getVariableValue(service: Record<string, unknown>, key: string) {
  const candidates = [
    service.variables,
    service.env,
    service.environment,
    getRecord(service.deploy).variables,
    getRecord(service.deploy).env,
    getRecord(service.deploy).environment,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const value = getVariableValueFromArray(candidate, key);
      if (value) {
        return value;
      }
    }

    if (isRecord(candidate)) {
      const value = getVariableValueFromRecord(candidate, key);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function validateWorkerStartCommand(serviceName: string, startCommand: string, errors: string[]) {
  if (/\bworker:once\b/.test(startCommand) || /(^|\s)--once(\s|$)/.test(startCommand)) {
    errors.push(`${serviceName} must use the continuous worker entrypoint, not a one-shot worker command.`);
  }

  if (/(^|\s)pnpm\s+worker(\s|$)/.test(startCommand)) {
    errors.push(`${serviceName} start command must run the worker with node directly, not pnpm worker.`);
  }

  if (startCommand.includes("&&")) {
    errors.push(`${serviceName} start command must use the single worker/start.ts entrypoint, not shell command chaining. Found: ${startCommand}`);
  }

  if (!/(^|\s)node(\s|$)/.test(startCommand) || !/(^|\s)worker\/start\.ts(\s|$)/.test(startCommand)) {
    errors.push(`${serviceName} start command must run node directly against worker/start.ts. Found: ${startCommand}`);
  }
}

function getRuntimeImportSpecifiers(path: string) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers = new Set<string>();

  function addModuleSpecifier(moduleSpecifier: ts.Expression | undefined) {
    if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
      specifiers.add(moduleSpecifier.text);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;
      const namedBindings = importClause?.namedBindings;
      const hasRuntimeBinding = !importClause
        || (!importClause.isTypeOnly && (
          Boolean(importClause.name)
          || Boolean(namedBindings && ts.isNamespaceImport(namedBindings))
          || Boolean(
            namedBindings
            && ts.isNamedImports(namedBindings)
            && namedBindings.elements.some((element) => !element.isTypeOnly),
          )
        ));

      if (hasRuntimeBinding) {
        addModuleSpecifier(node.moduleSpecifier);
      }
    } else if (ts.isExportDeclaration(node)) {
      const exportClause = node.exportClause;
      const hasRuntimeExport = !node.isTypeOnly
        && (!exportClause
          || !ts.isNamedExports(exportClause)
          || exportClause.elements.some((element) => !element.isTypeOnly));

      if (hasRuntimeExport) {
        addModuleSpecifier(node.moduleSpecifier);
      }
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
    ) {
      addModuleSpecifier(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return [...specifiers];
}

function resolveLocalImport(importerPath: string, specifier: string) {
  let unresolvedPath: string;

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    unresolvedPath = resolve(dirname(importerPath), specifier);
  } else if (specifier.startsWith("@/")) {
    unresolvedPath = resolve(specifier.slice(2));
  } else {
    return null;
  }

  const candidates = extname(unresolvedPath)
    ? [unresolvedPath]
    : [
      `${unresolvedPath}.ts`,
      `${unresolvedPath}.tsx`,
      `${unresolvedPath}.json`,
      resolve(unresolvedPath, "index.ts"),
      resolve(unresolvedPath, "index.tsx"),
    ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectWorkerRuntimeFiles(entrypointPath: string) {
  const pending = [resolve(entrypointPath)];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const currentPath = pending.pop()!;

    if (visited.has(currentPath)) {
      continue;
    }

    visited.add(currentPath);

    if (extname(currentPath) === ".json") {
      continue;
    }

    for (const specifier of getRuntimeImportSpecifiers(currentPath)) {
      const importedPath = resolveLocalImport(currentPath, specifier);

      if (importedPath && !visited.has(importedPath)) {
        pending.push(importedPath);
      }
    }
  }

  return [...visited].map((path) => normalize(relative(process.cwd(), path)));
}

function getLocalDockerCopySources(dockerfilePath: string) {
  return readFileSync(dockerfilePath, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^\s*COPY\s+(.+)$/i.exec(line);

      if (!match || /(?:^|\s)--from(?:=|\s)/.test(match[1])) {
        return [];
      }

      const argumentsList = match[1].trim().split(/\s+/);
      return argumentsList.slice(0, -1).map((path) => normalize(path.replace(/^\.\//, "")));
    });
}

function dockerCopyIncludesPath(copySources: readonly string[], requiredPath: string) {
  return copySources.some((source) => requiredPath === source || requiredPath.startsWith(`${source}${sep}`));
}

function validateWorkerRuntimeFiles(errors: string[]) {
  const copySources = getLocalDockerCopySources(WORKER_DOCKERFILE_PATH);
  const missingPaths = collectWorkerRuntimeFiles(WORKER_ENTRYPOINT_PATH)
    .filter((path) => !dockerCopyIncludesPath(copySources, path))
    .toSorted();

  if (missingPaths.length > 0) {
    errors.push(
      `${WORKER_DOCKERFILE_PATH} does not copy runtime files imported by ${WORKER_ENTRYPOINT_PATH}: ${missingPaths.join(", ")}`,
    );
  }
}

function validateTemplate(path: string) {
  const template = parseTemplate(path);
  const services = extractServices(template);
  const serviceByName = new Map(services.map((service) => [service.name, service.value]));
  const errors: string[] = [];
  for (const expectedService of EXPECTED_SERVICES) {
    if (!serviceByName.has(expectedService)) {
      errors.push(`Missing Railway service: ${expectedService}`);
    }
  }

  for (const [serviceName, expectedRole] of Object.entries(EXPECTED_WORKER_ROLES)) {
    const service = serviceByName.get(serviceName);

    if (!service) {
      continue;
    }

    const startCommand = getStartCommand(service);

    if (!startCommand) {
      errors.push(`${serviceName} must define a start command.`);
    } else {
      validateWorkerStartCommand(serviceName, startCommand, errors);
    }

    const role = getVariableValue(service, "STACKRAY_WORKER_ROLE");

    if (role !== expectedRole) {
      errors.push(`${serviceName} must set STACKRAY_WORKER_ROLE=${expectedRole} as a preconfigured variable. Found: ${role ?? "missing"}`);
    }

    const builder = getBuildValue(service, "builder");
    const dockerfilePath = getBuildValue(service, "dockerfilePath")
      ?? getVariableValue(service, "RAILWAY_DOCKERFILE_PATH");

    if (builder && builder !== "DOCKERFILE") {
      errors.push(`${serviceName} must use the Dockerfile builder for the scanner image. Found: ${builder}`);
    }

    if (dockerfilePath !== "worker/Dockerfile" && dockerfilePath !== "/worker/Dockerfile") {
      errors.push(`${serviceName} must use worker/Dockerfile for scanner dependencies. Found: ${dockerfilePath ?? "missing"}`);
    }
  }

  const websiteEncryptionKey = serviceByName.has("Stackray-website")
    ? getVariableValue(serviceByName.get("Stackray-website")!, "STACKRAY_ENCRYPTION_KEY")
    : null;
  const intelEncryptionKey = serviceByName.has("worker-intel")
    ? getVariableValue(serviceByName.get("worker-intel")!, "STACKRAY_ENCRYPTION_KEY")
    : null;

  if (websiteEncryptionKey !== EXPECTED_ENCRYPTION_KEY_GENERATOR) {
    errors.push(
      `Stackray-website must generate STACKRAY_ENCRYPTION_KEY with ${EXPECTED_ENCRYPTION_KEY_GENERATOR}. Found: ${websiteEncryptionKey ?? "missing"}`,
    );
  }

  if (intelEncryptionKey !== EXPECTED_ENCRYPTION_KEY_REFERENCE) {
    errors.push(
      `worker-intel must reference the website key with ${EXPECTED_ENCRYPTION_KEY_REFERENCE}. Found: ${intelEncryptionKey ?? "missing"}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Railway template validation failed for ${path}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.info(`Railway template validation passed for ${path}.`);
}

const configuredPath = process.env.STACKRAY_RAILWAY_TEMPLATE_PATH;
const templatePaths = configuredPath ? [configuredPath] : DEFAULT_TEMPLATE_PATHS.filter((path) => existsSync(path));
const workerRuntimeErrors: string[] = [];

validateWorkerRuntimeFiles(workerRuntimeErrors);

if (workerRuntimeErrors.length > 0) {
  throw new Error(`Worker runtime validation failed:\n${workerRuntimeErrors.map((error) => `- ${error}`).join("\n")}`);
}

console.info(`Worker runtime validation passed for ${WORKER_DOCKERFILE_PATH}.`);

if (templatePaths.length === 0) {
  console.info("No checked-in Railway template found; skipping Railway template validation.");
} else {
  for (const path of templatePaths) {
    validateTemplate(path);
  }
}
