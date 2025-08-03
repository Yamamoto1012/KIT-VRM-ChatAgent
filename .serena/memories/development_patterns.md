# 開発パターン・設計原則

## アーキテクチャパターン

### Container/View パターン
**責務分離による保守性向上**

```typescript
// Container: ビジネスロジック・状態管理
export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
  (props, ref) => {
    const [messages] = useAtom(messagesAtom);
    const [, addMessage] = useAtom(addMessageAtom);
    
    const handleSend = useCallback(async (content: string) => {
      // ビジネスロジック
      const response = await llmService.query(content);
      addMessage({ content: response, role: 'assistant' });
    }, [addMessage]);
    
    return (
      <ChatInterfaceView
        messages={messages}
        onSend={handleSend}
        {...props}
      />
    );
  }
);

// View: 純粋なプレゼンテーション
export const ChatInterfaceView = ({ messages, onSend }: Props) => {
  return (
    <div className="flex flex-col h-full">
      {/* UIロジックのみ */}
    </div>
  );
};
```

### State Management (Jotai Atomic Pattern)
**最小単位での状態管理・re-render最適化**

```typescript
// Feature-specific atoms
export const messagesAtom = atom<Message[]>([]);
export const isLoadingAtom = atom<boolean>(false);

// Action atoms (write-only)
export const addMessageAtom = atom(
  null,
  (get, set, payload: Message) => {
    const current = get(messagesAtom);
    set(messagesAtom, [...current, payload]);
  }
);

// Derived atoms (computed)
export const messageCountAtom = atom((get) => {
  return get(messagesAtom).length;
});

// Global app state
export const appStateAtom = atom((get) => ({
  currentScreen: get(currentScreenAtom),
  isMuted: get(isMutedAtom),
  isVRMLoaded: get(isVRMLoadedAtom),
}));
```

## VRM・3D統合パターン

### ExpressionManager - 中央制御システム
**表情制御の競合防止・安全性確保**

```typescript
// src/features/VRM/VRMExpression/ExpressionManager.ts
class ExpressionManager {
  private basicExpressions: Map<string, number> = new Map();
  private lipSyncExpressions: Map<string, number> = new Map();
  private sentimentExpressions: Map<string, number> = new Map();
  
  // 異なるソースからの表情制御を統合管理
  setExpression(name: string, value: number, source: ExpressionSource) {
    // VRM 1.0/2.0 差異を自動処理
    // エラーハンドリング付きの安全な設定
  }
  
  // リアルタイム更新
  updateExpressions(vrm: VRM) {
    // 全ソースの表情を合成して適用
  }
}
```

### Real-time Lip-sync Pattern
**音声分析からVRM口形状への変換**

```typescript
// src/features/VRM/LipSync/lipSync.ts
export const updateLipSync = (audioData: Float32Array, vrm: VRM) => {
  // Web Audio API による周波数解析
  const frequencies = analyzeFrequencies(audioData);
  
  // 周波数から音素への変換 (aa, ih, ou, ee, oh)
  const phonemeWeights = mapFrequenciesToPhonemes(frequencies);
  
  // 音量ベースの重み付けで表情適用
  applyLipSyncExpressions(vrm, phonemeWeights);
};

// AudioMutexManager - 音声競合制御
class AudioMutexManager {
  private currentSource: string | null = null;
  
  async playAudio(audioBlob: Blob, source: string): Promise<void> {
    // ストリーミング音声が既存TTS より優先
    // 一度に一つの音声のみ再生
  }
}
```

## API統合パターン

### Service Layer Pattern
**外部API統合の統一インターフェース**

```typescript
// src/services/llmService.ts
export class LLMService {
  private baseURL = '/api/llm';
  
  async queryStream(prompt: string): Promise<ReadableStream> {
    // ストリーミングレスポンス処理
    const response = await fetch(`${this.baseURL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: prompt }),
    });
    
    return response.body;
  }
  
  async query(prompt: string): Promise<string> {
    // 非ストリーミング フォールバック
  }
}

// Usage in hooks
export const useLLMQuery = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const queryLLM = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await llmService.query(prompt);
      return response;
    } catch (error) {
      console.error('LLM query failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return { queryLLM, isLoading };
};
```

### Streaming Response Pattern
**リアルタイムストリーミング処理**

```typescript
// src/hooks/useStreamingResponse.ts
export const useStreamingResponse = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const processStream = useCallback(async (stream: ReadableStream) => {
    setIsStreaming(true);
    setStreamingText('');
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setStreamingText(prev => prev + chunk);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);
  
  return { streamingText, isStreaming, processStream };
};
```

## Error Handling パターン

### Three.js Resource Management
**3Dリソースの安全な管理・メモリリーク防止**

```typescript
// src/features/VRM/hooks/useVRM.ts
export const useVRM = (modelPath: string) => {
  const [vrm, setVrm] = useState<VRM | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    const loadVRM = async () => {
      try {
        const loadedVrm = await loader.loadAsync(modelPath);
        if (!cancelled) {
          setVrm(loadedVrm);
        }
      } catch (error) {
        console.error('VRM loading failed:', error);
      }
    };
    
    loadVRM();
    
    return () => {
      cancelled = true;
      // Three.js リソース の適切な破棄
      if (vrm) {
        vrm.dispose();
      }
    };
  }, [modelPath]);
  
  return vrm;
};
```

### Error Boundary Pattern
**コンポーネントレベルのエラー境界**

```typescript
// src/components/VRMErrorBoundary.tsx
export const VRMErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-64">
          <p>VRM loading failed. Please reload the page.</p>
        </div>
      }
      onError={(error) => {
        console.error('VRM Error:', error);
        // モニタリングサービスへレポート
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

## Performance Optimization パターン

### Memoization Pattern
**重い計算・レンダリングの最適化**

```typescript
// Heavy computation memoization
export const useOptimizedMessages = () => {
  const [messages] = useAtom(messagesAtom);
  
  const processedMessages = useMemo(() => {
    return messages.map(msg => ({
      ...msg,
      timestamp: formatTimestamp(msg.createdAt),
      isMarkdown: detectMarkdown(msg.content),
    }));
  }, [messages]);
  
  return processedMessages;
};

// Component-level memoization
export const MessageItem = memo(({ message, onAction }: MessageItemProps) => {
  // 実装
}, (prevProps, nextProps) => {
  // カスタム比較ロジック
  return prevProps.message.id === nextProps.message.id;
});
```

### Responsive Design Pattern
**デバイス適応型UI**

```typescript
// src/hooks/useResponsive.ts
export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return { isMobile };
};

// Conditional rendering
export const ResponsiveLayout = ({ children }: Props) => {
  const { isMobile } = useResponsive();
  
  return isMobile ? (
    <MobileLayout>{children}</MobileLayout>
  ) : (
    <DesktopLayout>{children}</DesktopLayout>
  );
};
```

## Testing Patterns

### Feature Testing
**Container・View・Hooksの統合テスト**

```typescript
// src/features/ChatInterface/__tests__/ChatInterface.test.tsx
describe('ChatInterface', () => {
  it('should send message and receive response', async () => {
    const mockLLMService = {
      query: jest.fn().mockResolvedValue('Mock response'),
    };
    
    render(
      <Provider>
        <ChatInterface llmService={mockLLMService} />
      </Provider>
    );
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Mock response')).toBeInTheDocument();
    });
  });
});
```

## 多言語化パターン

### i18next Integration
**機能別翻訳管理**

```typescript
// src/features/ChatInterface/ChatInterface.tsx
export const ChatInterface = () => {
  const { t } = useTranslation('chat');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <Button>{t('sendButton')}</Button>
      <span>{t('messageCount', { count: messages.length })}</span>
    </div>
  );
};

// Translation files: src/locales/ja/chat.json
{
  "title": "チャット",
  "sendButton": "送信",
  "messageCount_one": "{{count}}件のメッセージ",
  "messageCount_other": "{{count}}件のメッセージ"
}
```

## 設計原則のまとめ

### 関数型プログラミング
- **Pure functions**: 副作用のない関数
- **Immutable data**: 状態の不変性
- **Early returns**: 可読性向上のための早期リターン

### コンポーネント設計
- **Single responsibility**: 単一責任の原則  
- **Props interface**: TypeScript型安全性
- **Container/View 分離**: ロジック・表示の分離

### 状態管理
- **Atomic state**: Jotaiによる最小単位の状態管理
- **Write-only actions**: 状態変更の明確な意図
- **Derived state**: 計算済み状態によるパフォーマンス向上