import re

with open('panel/src/services/aiService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove GoogleGenerativeAI import
content = re.sub(r"import\s*{\s*GoogleGenerativeAI\s*}\s*from\s*'@google/generative-ai';\n", "", content)

# 2. Rewrite sendAiMessage
# We need to replace the entire sendAiMessage function.
# It starts at export async function sendAiMessage(
# I will use a regex to find everything from sendAiMessage up to the end of the file, or write a custom parser.
# Alternatively, I can just replace the implementation of sendAiMessage up to executeConfirmedMutations

old_send_message_pattern = r"export async function sendAiMessage\(.*?\nexport async function executeConfirmedMutations"

new_send_message = '''export async function sendAiMessage(
  userMessage: string,
  conversationHistory: any[] = [],
  attachments: any[] = [],
  onChunk: ((chunk: string, fullText: string) => void) | null = null
): Promise<AiMessageResult> {
  const diagnosticStartedAt = Date.now();
  const relevantDeclarations = getRelevantToolsForQuery(userMessage, attachments);
  
  const recordOutcome = (
    selectedTools: string[],
    toolCalls: Array<{ toolName: string; status?: string }> = [],
    modelOutcome: 'TEXT' | 'EMPTY' | 'OFFLINE_FALLBACK' | 'MODEL_ERROR',
    modelAttempts: number,
    responseLength: number,
    fallbackReason: 'NO_API_KEY' | 'MODEL_FALLBACK_RESPONSE' | 'EMPTY_FINAL_RESPONSE' | 'ALL_MODELS_FAILED' | null = null
  ) => recordAiDiagnostic({
    id: i__,
    createdAt: new Date().toISOString(),
    intent: getQueryIntent(userMessage, attachments),
    selectedTools,
    executedTools: toolCalls.map((call) => ({ toolName: call.toolName, durationMs: 0, resultSizeBytes: 0, status: call.status === 'PENDING_USER_CONFIRMATION' ? 'PENDING_USER_CONFIRMATION' : 'SUCCESS' })),
    requestDurationMs: Date.now() - diagnosticStartedAt,
    modelOutcome,
    modelFinishReason: null,
    followedByToolCall: toolCalls.length > 0,
    fallbackReason,
    responseLength,
    modelAttempts
  });

  const toolExecutionLog: any[] = [];
  const generatedReports: AiReportDescriptor[] = [];
  const pendingMutations: PendingMutation[] = [];
  const toolResultsForFallback: Array<{ toolName: string; toolArgs: any; toolResult: any }> = [];
  let finalResponseText = '';
  
  let functionCallsToProcess: any[] | null = null;
  let iterations = 0;
  
  async function streamFromBackend(payload: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers();
    if (session?.access_token) {
      headers.set('Authorization', Bearer );
    }
    headers.set('Content-Type', 'application/json');
    
    // We use the same base URL approach as apiClient
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v2';
    const baseUrl = API_BASE_URL.replace(/\/api\/v2\/?$/, ''); // get http://localhost:5000
    
    const res = await fetch(${baseUrl}/api/ai/chat, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(Backend AI Hatası: );
    if (!res.body) throw new Error('ReadableStream not supported');
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\\n\\n');
      buffer = parts.pop() || '';
      
      for (const part of parts) {
        if (part.startsWith('data: ')) {
          try {
            const dataStr = part.replace('data: ', '').trim();
            if (!dataStr) continue;
            const data = JSON.parse(dataStr);
            if (data.type === 'text') {
              finalResponseText += data.text;
              if (onChunk) onChunk(data.text, finalResponseText);
            } else if (data.type === 'tool_call') {
              functionCallsToProcess = data.functionCalls;
            }
          } catch (e) {
            console.warn("SSE Parse Error:", e, part);
          }
        }
      }
    }
  }

  try {
    const initialPayload = {
      userMessage,
      conversationHistory,
      attachments,
      declarations: relevantDeclarations
    };
    
    await streamFromBackend(initialPayload);
    
    while (functionCallsToProcess && functionCallsToProcess.length > 0 && iterations < 6) {
      iterations++;
      const currentCalls = functionCallsToProcess;
      functionCallsToProcess = null;
      
      const readCalls = currentCalls.filter((c: any) => !MUTATING_TOOLS.includes(c.name));
      const writeCalls = currentCalls.filter((c: any) => MUTATING_TOOLS.includes(c.name));
      
      const readResultByCall = new Map<any, any>();
      await Promise.all(readCalls.map(async (call: any) => {
        const toolName = call.name;
        const toolArgs = call.args;
        const toolResult = await executeAiTool(toolName, toolArgs);
        const report = createAiReportDescriptor(toolName, toolResult);
        readResultByCall.set(call, { toolName, toolArgs, toolResult, report });
      }));
      
      const functionResponses: any[] = [];
      
      for (const call of currentCalls) {
        const toolName = call.name;
        const toolArgs = call.args;
        
        if (readResultByCall.has(call)) {
          const { toolResult, report } = readResultByCall.get(call)!;
          toolExecutionLog.push({ toolName, toolArgs });
          toolResultsForFallback.push({ toolName, toolArgs, toolResult });
          if (report) generatedReports.push(report);
          
          const fResponse: any = {
            name: toolName,
            response: typeof toolResult === 'object' && toolResult !== null
              ? buildCompactToolResponse(toolResult, report)
              : { result: toolResult }
          };
          if (call.id) fResponse.id = call.id;
          functionResponses.push({ functionResponse: fResponse });
        } else {
          const mutationId = mut___;
          const description = describeMutatingToolCall(toolName, toolArgs);
          pendingMutations.push({ id: mutationId, toolName, toolArgs, description });
          toolExecutionLog.push({ toolName, toolArgs, status: 'PENDING_USER_CONFIRMATION' });
          
          const fResponse: any = {
            name: toolName,
            response: {
              status: 'PENDING_USER_CONFIRMATION',
              message: Bu işlem HENÜZ UYGULANMADI. Kullanıcının bu değişikliği açıkça onaylaması gerekiyor: 
            }
          };
          if (call.id) fResponse.id = call.id;
          functionResponses.push({ functionResponse: fResponse });
        }
      }
      
      if (writeCalls.length > 0) {
        break; // Stop loop, await user confirmation
      }
      
      // Send tool results back to backend
      const nextPayload = {
        functionResponses,
        conversationHistory, // Just in case backend needs it, though backend maintains history internally in session if we passed a chat session ID. Actually aiRouter just instantiates a chat each time. Wait, if it instantiates a chat each time, we need to pass conversationHistory properly. But we just added support for functionResponses in aiRouter!
        declarations: relevantDeclarations
      };
      
      await streamFromBackend(nextPayload);
    }
    
    if (!finalResponseText && toolExecutionLog.length > 0) {
      finalResponseText = buildToolResultsFallback(toolResultsForFallback);
      if (onChunk) onChunk(finalResponseText, finalResponseText);
    }
    
    if (generatedReports.length > 0 && pendingMutations.length === 0) {
      finalResponseText = buildExecutiveReportChatSummary(generatedReports);
      if (onChunk) onChunk(finalResponseText, finalResponseText);
    }
    
    recordOutcome(relevantDeclarations.map(t => t.name), toolExecutionLog, finalResponseText ? 'TEXT' : 'EMPTY', 1, finalResponseText.length);
    
    return {
      text: finalResponseText,
      toolCalls: toolExecutionLog,
      reports: generatedReports.length > 0 ? generatedReports : undefined,
      pendingMutations: pendingMutations.length > 0 ? pendingMutations : undefined,
      provider: 'gemini',
      modelName: 'backend-proxy'
    };

  } catch (err: any) {
    console.error("Backend AI Call failed:", err);
    const fallbackRes = await handleOfflineFallback(userMessage, err.message, attachments);
    if (onChunk && fallbackRes?.text) onChunk(fallbackRes.text, fallbackRes.text);
    recordOutcome(relevantDeclarations.map((tool) => tool.name), fallbackRes.toolCalls || [], 'OFFLINE_FALLBACK', 1, (fallbackRes.text || '').length, 'ALL_MODELS_FAILED');
    return { ...fallbackRes, provider: 'offline' };
  }
}

export async function executeConfirmedMutations'''

content = re.sub(old_send_message_pattern, new_send_message, content, flags=re.DOTALL)

with open('panel/src/services/aiService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated aiService.ts")
