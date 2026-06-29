import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

import { parse as parseYaml } from "yaml";

const DEFAULT_TEMPLATE_PATHS = [
  "railway-template.json",
  "railway-template.yaml",
  "railway-template.yml",
  ".railway/template.json",
  ".railway/template.yaml",
  ".railway/template.yml",
] as const;

const EXPECTED_SERVICES = ["web", "worker-http", "worker-intel", "worker-browser"] as const;
const EXPECTED_WORKER_ROLES = {
  "worker-http": "http",
  "worker-intel": "intel",
  "worker-browser": "browser",
} as const;

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

  if (!/(^|\s)node(\s|$)/.test(startCommand) || !/(^|\s)worker\/index\.ts(\s|$)/.test(startCommand)) {
    errors.push(`${serviceName} start command must run node directly against worker/index.ts. Found: ${startCommand}`);
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

  if (errors.length > 0) {
    throw new Error(`Railway template validation failed for ${path}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.info(`Railway template validation passed for ${path}.`);
}

const configuredPath = process.env.STACKRAY_RAILWAY_TEMPLATE_PATH;
const templatePaths = configuredPath ? [configuredPath] : DEFAULT_TEMPLATE_PATHS.filter((path) => existsSync(path));

if (templatePaths.length === 0) {
  console.info("No checked-in Railway template found; skipping Railway template validation.");
} else {
  for (const path of templatePaths) {
    validateTemplate(path);
  }
}
