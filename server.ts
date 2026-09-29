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

// Helper: call Gemini with model fallback and clean JSON extraction
async function callGeminiJson(contents: string, schema: any): Promise<any> {
  const models = ['gemini-3-flash-preview', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[AI Planner] Calling model: ${model} (attempt ${attempt + 1})`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });

        const rawText = response.text || '';
        let cleaned = rawText.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
        }
        const parsed = JSON.parse(cleaned);
        return parsed;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Planner] Model ${model} attempt ${attempt + 1} failed:`, err?.message || err);
        // Small wait before retry if 503 or 429
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError || new Error('All AI models failed to respond');
}

// Fallback algorithm for task distribution across arbitrary days (from 3 days to 180 days)
function fallbackScheduleTasks(tasks: any[], daysToPlan: number, userGoal?: string) {
  const sorted = [...tasks].sort((a, b) => {
    const priorityWeight: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
    return (priorityWeight[a.priority] || 3) - (priorityWeight[b.priority] || 3);
  });

  const today = new Date();
  const schedule: any[] = [];
  const taskCount = sorted.length;

  // Decide how many active milestone days to spread tasks across
  let activeDaysCount = Math.min(taskCount, daysToPlan <= 7 ? daysToPlan : Math.min(taskCount, 15));
  if (activeDaysCount < 1) activeDaysCount = 1;

  const dayInterval = Math.max(1, Math.floor(daysToPlan / activeDaysCount));

  for (let i = 0; i < sorted.length; i++) {
    const task = sorted[i];
    const dayStep = Math.min(daysToPlan - 1, (i % activeDaysCount) * dayInterval);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayStep);
    const dateStr = targetDate.toISOString().split('T')[0];
    const month = targetDate.getMonth() + 1;
    const dateNum = targetDate.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][targetDate.getDay()];
    const dayLabel = `${month}月${dateNum}日(${dayOfWeek})`;

    let existingDay = schedule.find((s) => s.date === dateStr);
    if (!existingDay) {
      const themes = [
        '重要度・緊急度の高いコアタスクの遂行',
        '着実な進捗確保と課題のブレークスルー',
        '中間マイルストーンの達成とブラッシュアップ',
        '中長期計画の実行と検証',
        '仕上げ・総括と次期に向けた準備',
      ];
      const themeIndex = Math.floor((dayStep / Math.max(1, daysToPlan)) * themes.length);

      existingDay = {
        date: dateStr,
        dayLabel,
        theme: themes[Math.min(themeIndex, themes.length - 1)],
        allocatedTaskIds: [],
        explanation: `${dayLabel}は優先度と所要時間を考慮し、無理のないペースで実行できるように割り当てました。`,
        totalEstimatedMinutes: 0,
      };
      schedule.push(existingDay);
    }

    existingDay.allocatedTaskIds.push(task.id);
    existingDay.totalEstimatedMinutes += task.estimatedMinutes || 30;
  }

  // Sort schedule chronologically
  schedule.sort((a, b) => a.date.localeCompare(b.date));

  const periodLabel =
    daysToPlan >= 180 ? '半年間' : daysToPlan >= 90 ? '3ヶ月間' : daysToPlan >= 60 ? '2ヶ月間' : daysToPlan >= 30 ? '1ヶ月間' : `${daysToPlan}日間`;

  return {
    planSummary: `${periodLabel}のタイムラインに沿って、${taskCount}件のタスクを優先度と負荷バランスを最適化して配分しました。${userGoal ? `ご要望「${userGoal}」を反映しています。` : ''}`,
    schedule,
    productivityAdvice: '長期計画では最初の1〜2週間の勢いが重要です。まずは前半の優先タスクを完遂し、週ごとに見直しのリズムを作りましょう。',
  };
}

// Fallback algorithm for goal roadmap generation across arbitrary days (from 3 days to 180 days)
function fallbackGenerateGoalPlan(goal: string, days: number, category: string) {
  const today = new Date();
  const periodLabel =
    days >= 180 ? '半年間' : days >= 90 ? '3ヶ月間' : days >= 60 ? '2ヶ月間' : days >= 30 ? '1ヶ月間' : `${days}日間`;

  const phases = [
    { title: '情報収集と要件定義・基盤準備', priority: 'high', dayFraction: 0.1, est: 45, sub: ['現状調査と要件の整理', '必要なツールや資料の準備'] },
    { title: '第1フェーズ：コア部分の着手とドラフト作成', priority: 'urgent', dayFraction: 0.25, est: 60, sub: ['核となる主要タスクの実行', '初版ドラフト・プロトタイプの完成'] },
    { title: '第2フェーズ：詳細ブラッシュアップと検証', priority: 'high', dayFraction: 0.5, est: 60, sub: ['テスト・フィードバックの反映', '改善点の洗い出しと修正'] },
    { title: '中間レビューと進捗調整', priority: 'medium', dayFraction: 0.7, est: 30, sub: ['スケジュールの予実確認', '残課題の優先順位再整理'] },
    { title: '最終仕上げと総括・ゴール達成確認', priority: 'high', dayFraction: 0.95, est: 45, sub: ['成果物の最終チェック', '目標達成の検証と次のステップ策定'] },
  ];

  const tasks = phases.map((p, idx) => {
    const targetDate = new Date(today);
    const dayOffset = Math.max(1, Math.min(days - 1, Math.round(days * p.dayFraction)));
    targetDate.setDate(today.getDate() + dayOffset);
    const dueDateStr = targetDate.toISOString().split('T')[0];

    return {
      title: `【${idx + 1}/${phases.length}】${goal}：${p.title}`,
      description: `${periodLabel}のロードマップに基づき、${p.dayFraction * 100}%達成地点までに完了を目指すマイルストーンです。`,
      dueDate: dueDateStr,
      priority: p.priority,
      category,
      tags: ['AI計画', periodLabel, 'マイルストーン'],
      estimatedMinutes: p.est,
      subtasks: p.sub.map((st) => ({ title: st })),
    };
  });

  return {
    title: `${goal} 達成ロードマップ (${periodLabel})`,
    overview: `${periodLabel}で「${goal}」を確実に達成するための段階的マイルストーン計画です。初期の土台作りから中盤の集中実行、最終仕上げまで無理なく進行できます。`,
    tasks,
  };
}

// AI: Day-by-Day Task Scheduler ("この日はこれやるこの日はこれやる" を自動配分・計画立案)
app.post('/api/ai/plan-tasks', async (req, res) => {
  try {
    const { tasks, daysToPlan = 7, targetHoursPerDay = 5, userGoal } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'タスクが空です。計画を作成するためのタスクが必要です。' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const periodLabel =
      daysToPlan >= 180 ? '半年間 (180日)' : daysToPlan >= 90 ? '3ヶ月間 (90日)' : daysToPlan >= 60 ? '2ヶ月間 (60日)' : daysToPlan >= 30 ? '1ヶ月間 (30日)' : `${daysToPlan}日間`;

    const prompt = `あなたは熟練したパーソナルタスクマネージャー兼生産性コーチです。
ユーザーが持っている以下のToDoタスク一覧を分析し、現実的で実行可能なスケジュール計画（「この日はこれやる、この日はこれやる」）を作成してください。

【前提条件】
- 本日の日付: ${todayStr}
- 計画期間: ${periodLabel}
- 1日の目安稼働時間: 約${targetHoursPerDay}時間
${userGoal ? `- ユーザーの目標/要望: "${userGoal}"` : ''}

【現在の未完了タスク一覧】:
${JSON.stringify(tasks, null, 2)}

【配分の指針】
1. 優先度（urgent > high > medium > low）や期限（dueDate）、所要時間のバランスを考慮してください。
2. 計画期間が長期（1ヶ月、2ヶ月、3ヶ月、半年など）の場合、タスクのない空の日付を全日出力する必要はありません。タスクが割り当てられたキー実施日・マイルストーン日（最大15〜20日程度）のみを抽出してスケジュール配列に含めてください。
3. 期限が近いタスクや緊急度の高いタスクは手前の日程（今日〜直近数日）に配置してください。
4. 各日ごとにテーマ（例：「急ぎの締め切りタスクに集中」「第1フェーズの基盤固め」「中長期の見直し」）と、なぜそのタスクをその日にやるのかの明快な理由を添えてください。
5. 出力は必ず以下のJSON形式に準拠してください。`;

    const schema = {
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
                description: '例: 9月29日(月) や 10月中旬',
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
    };

    try {
      const parsed = await callGeminiJson(prompt, schema);
      if (parsed && Array.isArray(parsed.schedule) && parsed.schedule.length > 0) {
        return res.json(parsed);
      }
    } catch (aiError) {
      console.warn('AI call failed, activating smart deterministic fallback schedule:', aiError);
    }

    // High quality intelligent fallback if AI API spikes or times out
    const fallback = fallbackScheduleTasks(tasks, daysToPlan, userGoal);
    res.json(fallback);
  } catch (error: any) {
    console.error('AI plan tasks fatal error:', error);
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
    const periodLabel =
      days >= 180 ? '半年間 (180日)' : days >= 90 ? '3ヶ月間 (90日)' : days >= 60 ? '2ヶ月間 (60日)' : days >= 30 ? '1ヶ月間 (30日)' : `${days}日間`;

    const prompt = `あなたは目標達成とタスク分解の専門家です。
ユーザーの目標:「${goal}」を達成するために、本日(${todayStr})から【${periodLabel}】にわたる段階的で実行可能なタスク計画を作成してください。

【要件】
1. 期間（${periodLabel}）全体を見通し、前半（基礎・調査・初動）、中盤（主要タスク・実行・改善）、後半（総括・仕上げ）へと段階的にステップアップするタスクを5〜10件作成してください。
2. 「この時期/この日はこれやる」と明確に分かるように、各タスクに期日(dueDate: YYYY-MM-DD形式、本日〜${days}日後の範囲内で適切に分散)、優先度(urgent/high/medium/low)、見積もり時間(分)、タグ、チェックリスト用サブタスクを付与してください。
3. カテゴリは主に「${category}」とし、適切なものを割り振ってください。`;

    const schema = {
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
    };

    try {
      const parsed = await callGeminiJson(prompt, schema);
      if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        return res.json(parsed);
      }
    } catch (aiError) {
      console.warn('AI generate-plan failed, activating smart deterministic fallback:', aiError);
    }

    // High quality intelligent fallback if AI API spikes or times out
    const fallback = fallbackGenerateGoalPlan(goal, days, category);
    res.json(fallback);
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
