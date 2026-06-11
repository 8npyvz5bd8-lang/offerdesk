import { pathToFileURL } from "node:url";
import { connectAlipayService } from "./connect-alipay-service.mjs";
import { validateAlipayEnv } from "./validate-alipay-env.mjs";
import { validateAlipayService } from "./validate-alipay-service.mjs";

export async function finalizeAlipayLaunch(options) {
  const envReport = await validateAlipayEnv({
    env: options.env || process.env,
    file: options.envFile
  });
  if (envReport.failed > 0) {
    throw new Error(`支付宝部署环境预检失败：${failedNames(envReport).join("、")}。`);
  }

  const service = await validateAlipayService({
    apiBase: options.apiBase,
    email: options.email,
    name: options.name,
    fetchImpl: options.fetchImpl || fetch
  });
  const connected = await connectAlipayService({
    apiBase: options.apiBase,
    config: options.config,
    out: options.out,
    fetchImpl: options.fetchImpl || fetch
  });

  return { envReport, service, connected };
}

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith("--")) {
      throw new Error(`无法识别参数：${key}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：${key}`);
    }
    values[key.slice(2)] = value;
    index += 1;
  }
  return {
    envFile: values["env-file"],
    apiBase: values["api-base"],
    email: values.email,
    name: values.name,
    config: values.config,
    out: values.out
  };
}

function failedNames(report) {
  return report.checks.filter((item) => !item.pass).map((item) => item.name);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await finalizeAlipayLaunch(parseArgs(process.argv.slice(2)));
    console.log("支付宝自动收款接入完成");
    console.log(`环境预检：${result.envReport.passed} 通过，0 失败`);
    console.log(`测试订单：${result.service.order.orderId}`);
    console.log(`配置写入：${result.connected.output}`);
    console.log("下一步：提交 app-config.js，等待 GitHub Pages 更新后做一笔真实付款验收。");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
