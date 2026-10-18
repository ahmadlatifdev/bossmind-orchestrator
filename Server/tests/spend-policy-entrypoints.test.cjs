"use strict";

// Isolated tests for this legacy snapshot. No DBOS activation, live data,
// credentials or provider transport are required or inspected.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { assertInferenceAllowed } = require("../core/spendPolicy.cjs");

const repositoryRoot = path.resolve(__dirname, "../..");

function loadIsolated(relativePath) {
  const counts = { credentialReads: 0, keyFileReads: 0, transports: 0, optionalImports: 0 };
  const posts = [];
  const output = [];
  const environment = new Proxy(Object.create(null), {
    get() {
      counts.credentialReads += 1;
      throw new Error("Credential/environment read before policy denial");
    },
  });
  const transport = () => {
    counts.transports += 1;
    throw new Error("Provider transport must not run");
  };
  const keyRead = () => {
    counts.keyFileReads += 1;
    throw new Error("Credential file must not be inspected");
  };
  const module = { exports: {} };
  const processStub = { env: environment, exitCode: 0 };
  const context = {
    module,
    exports: module.exports,
    __dirname: path.dirname(path.join(repositoryRoot, relativePath)),
    process: processStub,
    console: { error: (line) => output.push(String(line)), log: (line) => output.push(String(line)) },
    fetch: transport,
    AbortController,
    setTimeout: transport,
    clearTimeout() {},
    require(id) {
      if (id.endsWith("/spendPolicy.cjs")) return { assertInferenceAllowed };
      if (id === "express") {
        return { Router: () => ({ post: (route, handler) => posts.push({ route, handler }) }) };
      }
      if (id === "fs" || id === "node:fs") {
        return { existsSync: keyRead, readFileSync: keyRead };
      }
      if (id === "path" || id === "node:path") return path;
      if (["http", "https", "axios", "node:http", "node:https"].includes(id)) {
        return { request: transport, post: transport };
      }
      counts.optionalImports += 1;
      throw new Error("Provider/dotenv import must not run: " + id);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"), context, {
    filename: relativePath,
    timeout: 1000,
  });
  return { exported: module.exports, counts, posts, output, processStub };
}

function assertUntouched(harness) {
  assert.deepEqual(harness.counts, {
    credentialReads: 0,
    keyFileReads: 0,
    transports: 0,
    optionalImports: 0,
  });
}

for (const filename of [
  "Server/core/openrouterClient.cjs",
  "Server/core/providers/openrouterClient.cjs",
]) {
  test(filename + " denies before key resolution or transport", async () => {
    const harness = loadIsolated(filename);
    for (const args of [{}, { model: "claimed-free-model:free", messages: [{ role: "user", content: "READY" }] }]) {
      await assert.rejects(harness.exported.chat(args), (err) => err.code === "COST_POLICY_BLOCKED" && err.status === 403);
    }
    assertUntouched(harness);
  });
}

test("DeepSeek handler denies before optional clients, routing, or credentials", async () => {
  const harness = loadIsolated("Server/core/handleDeepseekChat.cjs");
  const result = await harness.exported({ req: {}, messages: [{ role: "user", content: "READY" }] });
  assert.equal(result.ok, false);
  assert.equal(result.code, "COST_POLICY_BLOCKED");
  assert.equal(result.status, 403);
  assertUntouched(harness);
});

for (const filename of ["Server/routes/openrouter.chat.cjs", "Server/routes/openrouter.cjs"]) {
  test(filename + " returns a structured 403 without credentials, retries or client loading", async () => {
    const harness = loadIsolated(filename);
    assert.equal(harness.posts.length, 1);
    let status;
    let response;
    const res = {
      status(value) { status = value; return this; },
      json(value) { response = value; return this; },
    };
    await harness.posts[0].handler({ body: { model: "claimed-free-model:free" } }, res);
    assert.equal(status, 403);
    assert.equal(response.ok, false);
    assert.equal(response.code, "COST_POLICY_BLOCKED");
    assertUntouched(harness);
  });
}

for (const filename of [
  "Server/tools/test-openrouter.cjs",
  "Server/tools/test-bossmind-openrouter.cjs",
  "server-test.js",
  "test-api.js",
]) {
  test(filename + " exits blocked without dotenv, transport or listener", () => {
    const harness = loadIsolated(filename);
    assert.equal(harness.processStub.exitCode, 1);
    assert.equal(harness.output.length, 1);
    const output = JSON.parse(harness.output[0]);
    assert.equal(output.ok, false);
    assert.equal(output.code, "COST_POLICY_BLOCKED");
    assertUntouched(harness);
  });
}

test("legacy browser service rejects before credential imports, configuration reads or transport", async () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "bossmind-dashboard/src/services/deepseek.js"), "utf8");
  assert.equal(/^\s*import\b/m.test(source), false);
  assert.equal(/import\s*\(|\brequire\s*\(/.test(source), false);
  // Mechanical export-only transform exercises the browser module's actual body
  // without a bundler, package imports, credentials or a running dashboard.
  const transformed = source.replace(/export const /g, "const ")
    .replace("export default DeepSeekService;", "module.exports = { DeepSeekService, coreAI, DEEPSEEK_API };");
  let transportCalls = 0;
  const context = {
    module: { exports: {} },
    fetch() { transportCalls += 1; throw new Error("Browser transport must not run"); },
  };
  vm.runInNewContext(transformed, context, { timeout: 1000 });
  const { DeepSeekService, coreAI, DEEPSEEK_API } = context.module.exports;
  const unreadable = new Proxy({}, { get() { throw new Error("Caller configuration must not be inspected"); } });
  const instance = new DeepSeekService(unreadable);
  for (const service of [instance, coreAI, DEEPSEEK_API, DEEPSEEK_API.service]) {
    for (const method of ["chat", "embed", "listModels"]) {
      await assert.rejects(service[method](unreadable), (err) =>
        err.code === "COST_POLICY_BLOCKED" && err.status === 403 && err.reason === "CLOUD_PROVIDER_PROHIBITED");
    }
  }
  await assert.rejects(instance._request(unreadable), (err) => err.code === "COST_POLICY_BLOCKED");
  assert.equal(transportCalls, 0);
});
