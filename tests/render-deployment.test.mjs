import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderYaml = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
const dockerIgnore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
const gitIgnore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");

assert.match(renderYaml, /type:\s*web/u);
assert.match(renderYaml, /name:\s*offerdesk-alipay-payment/u);
assert.match(renderYaml, /env:\s*docker/u);
assert.match(renderYaml, /healthCheckPath:\s*\/api\/health/u);
assert.match(renderYaml, /key:\s*OFFERDESK_DATA_FILE\s*\n\s*value:\s*"\/data\/orders\.json"/u);
assert.match(renderYaml, /disk:\s*\n\s*name:\s*offerdesk-orders\s*\n\s*mountPath:\s*\/data\s*\n\s*sizeGB:\s*1/u);
assert.match(dockerIgnore, /^secrets$/mu);
assert.match(dockerIgnore, /^\.env\*$/mu);
assert.match(dockerIgnore, /^\*\.env$/mu);
assert.match(gitIgnore, /^secrets\/$/mu);
assert.match(gitIgnore, /^\.env\*$/mu);
assert.match(gitIgnore, /^\*\.env$/mu);

console.log("render deployment tests passed");
