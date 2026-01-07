import React, { useState, useRef, useEffect, Component } from 'react';
import { SendHorizontal, Moon, Sun, Trash2, Loader2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

// Error Boundary for Markdown rendering
class MarkdownErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Markdown rendering error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.content !== this.props.content) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ whiteSpace: 'pre-wrap' }}>{this.props.content}</div>;
    }

    return this.props.children;
  }
}

// Code Block with animation
function AnimatedCodeBlock({ codeString, language, ...props }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const codeBlockRef = useRef(null);
  const prevCodeStringRef = useRef('');
  const animationTimeoutRef = useRef(null);
  const stableTimeoutRef = useRef(null);
  const hasAnimatedRef = useRef(false); // 애니메이션이 이미 실행되었는지 추적
  const lastStableCodeRef = useRef(''); // 마지막으로 안정화된 코드

  useEffect(() => {
    // 이전 타임아웃 정리
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    if (stableTimeoutRef.current) {
      clearTimeout(stableTimeoutRef.current);
    }

    // 코드가 변경되었을 때
    if (codeString && prevCodeStringRef.current !== codeString) {
      // 이전 코드가 비어있었고 현재 코드가 있으면 새로운 코드 블록 시작
      if (!prevCodeStringRef.current) {
        hasAnimatedRef.current = false;
        lastStableCodeRef.current = '';
      }

      // 코드가 안정화될 때까지 대기 (1000ms 동안 변경되지 않으면 완성된 것으로 간주)
      // 그리고 아직 애니메이션이 실행되지 않았을 때만
      if (!hasAnimatedRef.current) {
        const currentCode = codeString;
        stableTimeoutRef.current = setTimeout(() => {
          // 코드가 여전히 동일한지 확인 (완성된 것으로 간주)
          if (currentCode === codeString && currentCode.length > 0 && !hasAnimatedRef.current) {
            // 마지막 안정화된 코드와 다를 때만 애니메이션 실행
            if (currentCode !== lastStableCodeRef.current) {
              // 애니메이션 트리거
              setIsAnimating(true);
              hasAnimatedRef.current = true; // 애니메이션 실행 표시
              lastStableCodeRef.current = currentCode;
              animationTimeoutRef.current = setTimeout(() => {
                setIsAnimating(false);
              }, 600); // 애니메이션 시간
            }
          }
        }, 1000); // 코드 안정화 대기 시간
      }
    }

    prevCodeStringRef.current = codeString;

    // 클린업
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (stableTimeoutRef.current) {
        clearTimeout(stableTimeoutRef.current);
      }
    };
  }, [codeString]);

  return (
    <div
      ref={codeBlockRef}
      className={`code-block-wrapper ${isAnimating ? 'code-block-animating' : ''}`}
    >
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        className="code-block"
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

// Safe Markdown component with error handling
function SafeMarkdown({ content }) {
  return (
    <MarkdownErrorBoundary content={content}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            return !inline && match ? (
              <AnimatedCodeBlock
                codeString={codeString}
                language={match[1]}
                {...props}
              />
            ) : (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}

// Apple-inspired modern chat interface
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:1234/v1/chat/completions');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [model, setModel] = useState('gemma-3-4b-it-qat');
  const [systemMessage, setSystemMessage] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 다크모드 적용
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // assistant 메시지 미리 생성 (스트리밍으로 업데이트할 것)
    const assistantMessageIndex = messages.length + 1; // user 메시지 추가 후 인덱스
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      // 메시지 배열 구성: system 메시지가 있으면 맨 앞에 추가
      const messageArray = [];
      if (systemMessage.trim()) {
        messageArray.push({ role: 'system', content: systemMessage });
      }
      // 기존 메시지와 새 사용자 메시지 추가
      messageArray.push(...messages, userMessage);

      const requestBody = {
        model: model || 'gemma-3-4b-it-qat',
        messages: messageArray,
        temperature: 0.7,
        max_tokens: -1,
        stream: true
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`요청 실패 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
      }

      // 스트리밍 응답 처리
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let detectedModel = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // 모델 정보 저장
              if (parsed.model && !detectedModel) {
                detectedModel = parsed.model;
                if (!model) {
                  setModel(parsed.model);
                }
              }

              // 델타 내용 추가
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;

                // 실시간으로 메시지 업데이트 (인덱스 기반)
                setMessages(prev => {
                  const newMessages = [...prev];
                  if (newMessages[assistantMessageIndex]) {
                    newMessages[assistantMessageIndex] = {
                      ...newMessages[assistantMessageIndex],
                      content: fullContent
                    };
                  }
                  return newMessages;
                });

                // 스크롤을 자동으로 하단으로 이동
                setTimeout(() => scrollToBottom(), 10);
              }
            } catch (e) {
              // JSON 파싱 오류 무시 (불완전한 청크일 수 있음)
            }
          }
        }
      }

      // 최종 메시지 확인 (빈 메시지인 경우)
      if (!fullContent.trim()) {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[assistantMessageIndex]) {
            newMessages[assistantMessageIndex] = {
              ...newMessages[assistantMessageIndex],
              content: '응답이 없습니다.',
              isError: true
            };
          }
          return newMessages;
        });
      }

    } catch (error) {
      // 에러 발생 시 assistant 메시지 업데이트
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[assistantMessageIndex]) {
          newMessages[assistantMessageIndex] = {
            ...newMessages[assistantMessageIndex],
            content: `오류가 발생했습니다: ${error.message}`,
            isError: true
          };
        } else {
          // 메시지가 없으면 새로 추가
          newMessages.push({
            role: 'assistant',
            content: `오류가 발생했습니다: ${error.message}`,
            isError: true
          });
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setModel(model || 'gemma-3-4b-it-qat'); // 모델명 유지
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="app">

      <div className="chat-container">
        <header className="header">
          <div className="header-left">
            <h1 className="logo-title">Claude</h1>
            {model && <span className="model-badge">{model}</span>}
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={clearChat}
              title="대화 초기화"
            >
              <Trash2 size={18} />
            </button>
            <button
              className="icon-button"
              onClick={toggleDarkMode}
              title={isDarkMode ? "라이트 모드" : "다크 모드"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <MessageSquare size={24} strokeWidth={1.5} />
              </div>
              <h2>대화를 시작하세요</h2>
              <p>메시지를 입력해 주세요</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role} ${message.isError ? 'error' : ''}`}
              >
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <SafeMarkdown content={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message assistant loading">
              <div className="message-content">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="send-button"
              title="전송"
            >
              {isLoading ? (
                <Loader2 className="spinner" size={16} strokeWidth={2.5} />
              ) : (
                <SendHorizontal size={16} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}