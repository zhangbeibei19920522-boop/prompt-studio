"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { settingsApi } from "@/lib/utils/api-client"

type Provider =
  | "OpenAI"
  | "Claude"
  | "Kimi"
  | "GLM"
  | "DeepSeek"
  | "通义千问"
  | "其他"

const PROVIDERS: Provider[] = [
  "OpenAI",
  "Claude",
  "Kimi",
  "GLM",
  "DeepSeek",
  "通义千问",
  "其他",
]

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  OpenAI: "https://api.openai.com/v1",
  Claude: "https://api.anthropic.com",
  Kimi: "https://api.moonshot.cn/v1",
  GLM: "https://open.bigmodel.cn/api/paas/v4",
  DeepSeek: "https://api.deepseek.com/v1",
  通义千问: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  其他: "",
}

type ModelConfig = {
  provider: Provider
  apiKey: string
  model: string
  baseUrl: string
}

type GlobalBusinessInfo = {
  businessDescription: string
  businessGoal: string
  businessBackground: string
}

const INITIAL_MODEL_CONFIG: ModelConfig = {
  provider: "OpenAI",
  apiKey: "",
  model: "gpt-4o",
  baseUrl: DEFAULT_BASE_URLS["OpenAI"],
}

const INITIAL_GLOBAL_BUSINESS: GlobalBusinessInfo = {
  businessDescription:
    "面向电商平台的智能客服系统。强制规则：1. 所有回复必须包含礼貌用语 2. 涉及退款问题必须引导至人工客服",
  businessGoal: "提升客服回复质量和效率，降低人工客服工作量",
  businessBackground:
    "当前客服系统使用 GPT-4o 处理用户咨询，prompt 分布在欢迎语、问题分类、回复生成三个环节",
}

export default function SettingsPage() {
  const router = useRouter()

  const [modelConfig, setModelConfig] =
    React.useState<ModelConfig>(INITIAL_MODEL_CONFIG)
  const [globalBusiness, setGlobalBusiness] =
    React.useState<GlobalBusinessInfo>(INITIAL_GLOBAL_BUSINESS)
  const [loaded, setLoaded] = React.useState(false)

  // Load settings from API on mount
  React.useEffect(() => {
    settingsApi.get().then((s) => {
      if (s.provider) setModelConfig({ provider: s.provider as Provider, apiKey: s.apiKey, model: s.model, baseUrl: s.baseUrl })
      if (s.businessDescription || s.businessGoal || s.businessBackground) {
        setGlobalBusiness({ businessDescription: s.businessDescription, businessGoal: s.businessGoal, businessBackground: s.businessBackground })
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const updateModelConfig = <K extends keyof ModelConfig>(
    key: K,
    value: ModelConfig[K]
  ) => {
    if (key === "provider") {
      const provider = value as Provider
      setModelConfig((prev) => ({
        ...prev,
        provider,
        baseUrl: DEFAULT_BASE_URLS[provider],
      }))
    } else {
      setModelConfig((prev) => ({ ...prev, [key]: value }))
    }
  }

  const updateGlobalBusiness = <K extends keyof GlobalBusinessInfo>(
    key: K,
    value: GlobalBusinessInfo[K]
  ) => {
    setGlobalBusiness((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveModelConfig = async () => {
    try {
      await settingsApi.update({
        provider: modelConfig.provider,
        apiKey: modelConfig.apiKey,
        model: modelConfig.model,
        baseUrl: modelConfig.baseUrl,
      })
      alert("模型配置已保存")
    } catch (e) {
      alert("保存失败: " + (e instanceof Error ? e.message : "未知错误"))
    }
  }

  const handleSaveGlobalBusiness = async () => {
    try {
      await settingsApi.update({
        businessDescription: globalBusiness.businessDescription,
        businessGoal: globalBusiness.businessGoal,
        businessBackground: globalBusiness.businessBackground,
      })
      alert("业务信息已保存")
    } catch (e) {
      alert("保存失败: " + (e instanceof Error ? e.message : "未知错误"))
    }
  }

  const baseUrlPlaceholder =
    DEFAULT_BASE_URLS[modelConfig.provider] || "请输入 API 地址"

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="flex h-14 items-center gap-2 border-b bg-white px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-1"
        >
          <ChevronLeft />
          返回
        </Button>
        <h1 className="text-base font-semibold">全局设置</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
        {/* AI 模型配置 */}
        <Card>
          <CardHeader>
            <CardTitle>AI 模型配置</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Provider */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">模型提供商</label>
              <select
                value={modelConfig.provider}
                onChange={(e) =>
                  updateModelConfig("provider", e.target.value as Provider)
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                placeholder="请输入 API Key"
                value={modelConfig.apiKey}
                onChange={(e) => updateModelConfig("apiKey", e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Model */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">模型名称</label>
              <Input
                placeholder="例如：gpt-4o、claude-opus-4-6"
                value={modelConfig.model}
                onChange={(e) => updateModelConfig("model", e.target.value)}
              />
            </div>

            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">API 地址</label>
              <Input
                placeholder={baseUrlPlaceholder}
                value={modelConfig.baseUrl}
                onChange={(e) => updateModelConfig("baseUrl", e.target.value)}
              />
              {DEFAULT_BASE_URLS[modelConfig.provider] && (
                <p className="text-muted-foreground text-xs">
                  默认地址：{DEFAULT_BASE_URLS[modelConfig.provider]}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveModelConfig}>保存</Button>
            </div>
          </CardContent>
        </Card>

        {/* 全局业务信息 */}
        <Card>
          <CardHeader>
            <CardTitle>全局业务信息</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Business Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">业务说明</label>
              <p className="text-muted-foreground text-xs">
                包含需要强制写入 prompt 的规则
              </p>
              <Textarea
                placeholder="请输入全局业务说明"
                value={globalBusiness.businessDescription}
                onChange={(e) =>
                  updateGlobalBusiness("businessDescription", e.target.value)
                }
                className="min-h-28 resize-none"
              />
            </div>

            {/* Business Goal */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">业务目标</label>
              <Textarea
                placeholder="请输入全局业务目标"
                value={globalBusiness.businessGoal}
                onChange={(e) =>
                  updateGlobalBusiness("businessGoal", e.target.value)
                }
                className="min-h-28 resize-none"
              />
            </div>

            {/* Business Background */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">业务背景</label>
              <Textarea
                placeholder="请输入全局业务背景"
                value={globalBusiness.businessBackground}
                onChange={(e) =>
                  updateGlobalBusiness("businessBackground", e.target.value)
                }
                className="min-h-28 resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveGlobalBusiness}>保存</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
