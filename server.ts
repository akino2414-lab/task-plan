import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists for server-side persistence of sync rooms
const DATA_DIR = path.resolve(process.cwd(), '.sync_data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache for fast lookups
const syncRoomsCache = new Map<string, { data: any; updatedAt: number }>();

function getRoomFilePath(syncCode: string): string {
  // sanitize sync code
  const safeCode = syncCode.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return path.join(DATA_DIR, `${safeCode}.json`);
}

function loadRoom(syncCode: string) {
  if (syncRoomsCache.has(syncCode)) {
    return syncRoomsCache.get(syncCode);
  }
  const filePath = getRoomFilePath(syncCode);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      syncRoomsCache.set(syncCode, parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to read room data:', e);
    }
  }
  return null;
}

function saveRoom(syncCode: string, data: any) {
  const payload = {
    data,
    updatedAt: Date.now(),
  };
  syncRoomsCache.set(syncCode, payload);
  try {
    const filePath = getRoomFilePath(syncCode);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save room data:', e);
  }
  return payload;
}

// Gemini AI Client setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// --- API ROUTES ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Sync: GET room
app.get('/api/sync/:syncCode', (req, res) => {
  const { syncCode } = req.params;
  if (!syncCode) {
    return res.status(400).json({ error: 'Sync code is required' });
  }
  const room = loadRoom(syncCode);
  if (!room) {
    return res.status(404).json({ message: 'Room not found or empty' });
  }
  res.json(room);
});

// Sync: POST/PUT room
app.post('/api/sync/:syncCode', (req, res) => {
  const { syncCode } = req.params;
  const { data } = req.body;
  if (!syncCode || !data) {
    return res.status(400).json({ error: 'Sync code and data are required' });
  }
  const saved = saveRoom(syncCode, data);
  res.json({ success: true, updatedAt: saved.updatedAt });
});

// AI: Day-by-Day Task Scheduler ("この日はこれやるこの日はこれやる" を自動配分・計画立案)
app.post('/api/ai/plan-tasks', async (req, res) => {
  try {
    const { tasks, daysToPlan = 7, targetHoursPerDay = 5, userGoal } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'タスクが空です。計画を作成するためのタスクが必要です。' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const prompt = `あなたは熟練したパーソナルタスクマネージャー兼生産性コーチです。
ユーザーが持っている以下のToDoタスク一覧を分析し、現実的で実行可能な「日別スケジュール計画（この日はこれやる、この日はこれやる）」を作成してください。

【前提条件】
- 本日の日付: ${todayStr}
- 計画期間: ${daysToPlan}日間
- 1日の目安稼働時間: 約${targetHoursPerDay}時間
${userGoal ? `- ユーザーの目標/要望: "${userGoal}"` : ''}

【現在の未完了タスク一覧】:
${JSON.stringify(tasks, null, 2)}

【要件】
1. 優先度（urgent > high > medium > low）や期限（dueDate）、所要時間のバランスを考慮してください。
2. 特定の日だけにタスクが偏りすぎないよう、負荷を均等に分散してください。
3. 期限が近いタスクや緊急度の高いタスクは手前の日程（今日〜2日目）に配置してください。
4. 各日ごとにテーマ（例：「急ぎの締め切りタスクに集中」「中長期の準備＆整理」）と、なぜそのタスクをその日にやるのかの明快な理由を添えてください。
5. 出力は必ず以下のJSON形式に準拠してください。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            planSummary: {
              type: Type.STRING,
              description: '計画全体のサマリーとアドバイス',
            },
            schedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: {
                    type: Type.STRING,
                    description: 'YYYY-MM-DD形式の日付',
                  },
                  dayLabel: {
                    type: Type.STRING,
                    description: '例: 9月29日(月)',
                  },
                  theme: {
                    type: Type.STRING,
                    description: 'その日のフォーカスやテーマ',
                  },
                  allocatedTaskIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'その日に割り当てる既存タスクのid配列',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'この日にこれらのタスクを配分した理由や進め方のコツ',
                  },
                  totalEstimatedMinutes: {
                    type: Type.INTEGER,
                    description: 'その日の合計見積もり分数',
                  },
                },
                required: ['date', 'dayLabel', 'theme', 'allocatedTaskIds', 'explanation', 'totalEstimatedMinutes'],
              },
            },
            productivityAdvice: {
              type: Type.STRING,
              description: '計画を完遂するための実践的なアドバイス',
            },
          },
          required: ['planSummary', 'schedule', 'productivityAdvice'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('AI plan tasks error:', error);
    res.status(500).json({ error: error.message || 'AI計画の生成中にエラーが発生しました' });
  }
});

// AI: Goal Breakdown into Scheduled Tasks (目標から日別タスクスケジュールを一から生成)
app.post('/api/ai/generate-plan', async (req, res) => {
  try {
    const { goal, days = 5, category = 'work' } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({ error: '目標を入力してください' });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const prompt = `あなたは目標達成とタスク分解の専門家です。
ユーザーの目標:「${goal}」を達成するために、本日(${todayStr})から${days}日間にわたる具体的で実行可能な日別タスク計画を作成してください。

「この日はこれやる、この日はこれやる」と明確に分かるように、各タスクに日付(dueDate)、優先度(urgent/high/medium/low)、見積もり時間(分)、タグ、チェックリスト用サブタスクを付与してください。
カテゴリは主に「${category}」とし、適切なものを割り振ってください。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: '計画のタイトル',
            },
            overview: {
              type: Type.STRING,
              description: '計画の概要と進め方の方針',
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  dueDate: { type: Type.STRING, description: 'YYYY-MM-DD形式' },
                  priority: { type: Type.STRING, enum: ['urgent', 'high', 'medium', 'low'] },
                  category: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  estimatedMinutes: { type: Type.INTEGER },
                  subtasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                      },
                      required: ['title'],
                    },
                  },
                },
                required: ['title', 'dueDate', 'priority', 'category', 'estimatedMinutes'],
              },
            },
          },
          required: ['title', 'overview', 'tasks'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('AI generate plan error:', error);
    res.status(500).json({ error: error.message || '目標計画の生成中にエラーが発生しました' });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TaskFlow server running on http://0.0.0.0:${port}`);
  });
}

startServer();
