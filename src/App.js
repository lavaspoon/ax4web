import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Settings, Trash2, Loader2, MessageSquare, ChevronDown, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

// Apple-inspired modern chat interface
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:1234/v1/chat/completions');
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState('gemma-3-4b-it-qat');
  const [systemMessage, setSystemMessage] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
              className={`icon-button ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="설정"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {showSettings && (
          <div className="settings-panel">
            <div className="settings-row">
              <div className="settings-field">
                <label>API 주소</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1/chat/completions"
                />
              </div>
              <div className="settings-field">
                <label>모델명</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gemma-3-4b-it-qat"
                />
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-field">
                <label>시스템 메시지 (선택사항)</label>
                <input
                  type="text"
                  value={systemMessage}
                  onChange={(e) => setSystemMessage(e.target.value)}
                  placeholder="예: Always answer in rhymes."
                />
              </div>
            </div>
          </div>
        )}

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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');

                          return !inline && match ? (
                            <div className="code-block-wrapper">
                              <div className="code-block-header">
                                <span className="code-block-language">{match[1]}</span>
                              </div>
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="code-block"
                                {...props}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
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
                      {message.content}
                    </ReactMarkdown>
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