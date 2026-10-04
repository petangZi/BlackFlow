/**
 * Connector Engine - Executes HTTP Manifest connectors
 */

export class ConnectorEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async execute(entry, credential, input, callbacks = {}) {
    if (!entry.manifest) throw new Error('No manifest for entry');
    
    // Load manifest
    const manifest = await this.loadManifest(entry.manifest.file);
    if (!manifest) throw new Error('Manifest not found');
    
    // Execute steps
    const context = { ...input, credential };
    const results = {};
    
    for (const step of manifest.steps) {
      await callbacks.onProgress?.(Math.round((manifest.steps.indexOf(step) / manifest.steps.length) * 100));
      
      const result = await this.executeStep(step, context, results);
      results[step.id] = result;
    }
    
    // Map output
    const output = this.mapOutput(manifest.map_out, results);
    
    return { output_ref: output };
  }

  async loadManifest(manifestPath) {
    // In production, load from storage or bundled
    // For now, return a mock
    return {
      steps: [
        { id: 'start', call: 'GET {base}/start/compress' },
        { id: 'upload', call: 'POST {start.server}/upload', file: '{input.file}' },
        { id: 'process', call: 'POST {start.server}/process', body: { task: '{start.task}', level: '{input.level}' } },
        { id: 'result', call: 'GET {start.server}/download/{start.task}', save_as: 'output.file' }
      ],
      map_out: { file: '{result.file}', result_bytes: '{result.size}' }
    };
  }

  async executeStep(step, context, results) {
    // Interpolate variables
    const url = this.interpolate(step.call, context, results);
    const [method, path] = url.split(' ');
    
    const headers = this.buildHeaders(step, context);
    const body = step.body ? this.interpolate(JSON.stringify(step.body), context, results) : undefined;
    
    const response = await fetch(url, { method, headers, body });
    
    if (!response.ok) {
      throw new Error(`Step ${step.id} failed: ${response.status}`);
    }
    
    return response.json();
  }

  interpolate(template, context, results) {
    return template.replace(/\{(\w+)\.(\w+)\}/g, (match, source, key) => {
      if (source === 'input') return context[key];
      if (source === 'credential') return context[key];
      if (results[source]) return results[source][key];
      return match;
    });
  }

  buildHeaders(step, context) {
    const headers = { 'Content-Type': 'application/json' };
    if (context.credential) {
      headers['Authorization'] = `Bearer ${context.credential}`;
    }
    return headers;
  }

  mapOutput(mapOut, results) {
    const output = {};
    for (const [key, template] of Object.entries(mapOut)) {
      output[key] = this.interpolate(template, {}, results);
    }
    return output;
  }
}

export default ConnectorEngine;