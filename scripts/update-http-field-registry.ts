import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const sourceUrl = "https://www.iana.org/assignments/http-fields/field-names.csv";
const outputPath = join(
  process.cwd(),
  "lib/server/changes/generated/http-field-registry.json",
);

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((entry) => entry.length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (quoted) {
    throw new Error("IANA HTTP field registry contains an unterminated quoted value.");
  }

  return rows;
}

async function main() {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to download IANA HTTP field registry: ${response.status}`);
  }

  const [headers, ...rows] = parseCsv(await response.text());
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["Field Name", "Status", "Structured Type", "Reference", "Comments"];

  for (const header of requiredHeaders) {
    if (!indexByHeader.has(header)) {
      throw new Error(`IANA HTTP field registry is missing the ${header} column.`);
    }
  }

  const fields = rows.map((row) => ({
    name: row[indexByHeader.get("Field Name")!]?.trim() ?? "",
    status: row[indexByHeader.get("Status")!]?.trim().toLowerCase() ?? "",
    structuredType: row[indexByHeader.get("Structured Type")!]?.trim() || null,
    reference: row[indexByHeader.get("Reference")!]?.trim() || null,
    comments: row[indexByHeader.get("Comments")!]?.trim() || null,
  })).filter((field) => field.name.length > 0);

  const normalizedNames = fields.map((field) => field.name.toLowerCase());
  if (new Set(normalizedNames).size !== fields.length) {
    throw new Error("IANA HTTP field registry contains duplicate field names.");
  }

  fields.sort((left, right) => left.name.localeCompare(right.name));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ source: sourceUrl, fields })}\n`, "utf8");
  console.log(`Updated ${fields.length} HTTP field definitions in ${outputPath}.`);
}

await main();
