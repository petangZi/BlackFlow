/**
 * SSE Parser and Writer utilities
 */

export class SSEParser {
  constructor() {
    this.buffer = '';
  }

  feed(chunk) {
    this.buffer += chunk;
    const events = [];
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) events.push(event);
    }
    
    return events;
  }

  parseLine(line) {
    if (!line.startsWith('data: ')) return null;
    
    const data = line.slice(6);
    if (data === '[DONE]') return { type: 'done' };
    
    try {
      return JSON.parse(data);
    } catch {
      return { type: 'raw', data };
    }
  }
}

export class SSEWriter {
  constructor(controller, encoder) {
    this.controller = controller;
    this.encoder = encoder;
  }

  async write(event, data) {
    const payload = `data: ${JSON.stringify({ type: event, ...data })}\n\n`;
    await this.controller.enqueue(this.encoder.encode(payload));
  }

  async close() {
    await this.controller.enqueue(this.encoder.encode('data: [DONE]\n\n'));
    this.controller.close();
  }
}

export function createSSEResponse(stream, requestId, meta = {}) {
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const writer = new SSEWriter(controller, encoder);
      
      try {
        await writer.write('meta', { requestId, ...meta });
        
        for await (const chunk of stream) {
          if (chunk.type === 'delta') {
            await writer.write('delta', { text: chunk.text });
          } else if (chunk.type === 'tool_call') {
            await writer.write('tool_call', chunk.data);
          } else if (chunk.type === 'tool_progress') {
            await writer.write('tool_progress', chunk.data);
          } else if (chunk.type === 'tool_result') {
            await writer.write('tool_result', chunk.data);
          } else if (chunk.type === 'citations') {
            await writer.write('citations', chunk.data);
          } else if (chunk.type === 'file') {
            await writer.write('file', chunk.data);
          } else if (chunk.type === 'usage') {
            await writer.write('usage', chunk.data);
          }
        }
        
        await writer.write('done', {});
        controller.close();
      } catch (err) {
        await writer.write('error', {
          code: 'STREAM_ERROR',
          message: err.message,
          retriable: false
        });
        controller.error(err);
      }
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-BlackFlow-Request-Id': requestId
    }
  });
}

export default { SSEParser, SSEWriter, createSSEResponse };