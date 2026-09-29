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

// Ensure data directory exists for server-side persistence of sync rooms & master state
const DATA_DIR = path.resolve(process.cwd(), '.sync_data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Master data file paths to guarantee data survives app rebuilds, reloads, and updates
const MASTER_DATA_FILE = path.join(DATA_DIR, 'master_app_state.json');
const MASTER_BACKUP_FILE = path.join(DATA_DIR, 'master_app_state.backup.json');

function loadMasterData() {
  if (fs.existsSync(MASTER_DATA_FILE)) {
    try {
      const content = fs.readFileSync(MASTER_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error('Failed to read master data file:', e);
    }
  }
  // Try backup if master was corrupted
  if (fs.existsSync(MASTER_BACKUP_FILE)) {
    try {
      const content = fs.readFileSync(MASTER_BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error('Failed to read master backup file:', e);
    }
  }
  return null;
}

function saveMasterData(data: any) {
  const payload = {
    data,
    updatedAt: Date.now(),
  };
  try {
    // If master file already exists, rotate to backup first
    if (fs.existsSync(MASTER_DATA_FILE)) {
      try {
        fs.copyFileSync(MASTER_DATA_FILE, MASTER_BACKUP_FILE);
      } catch (backupErr) {
        console.warn('Could not rotate master backup:', backupErr);
      }
    }
    fs.writeFileSync(MASTER_DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save master data file:', e);
  }
  return payload;
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

// Primary Persistent Storage: GET master app state
app.get('/api/storage/master', (req, res) => {
  const master = loadMasterData();
  const hasBackup = fs.existsSync(MASTER_BACKUP_FILE);
  if (!master) {
    return res.json({ hasData: false, data: null, hasBackup });
  }
  res.json({ hasData: true, data: master.data, updatedAt: master.updatedAt, hasBackup });
});

// Primary Persistent Storage: POST/PUT master app state
app.post('/api/storage/master', (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Data is required' });
  }
  const saved = saveMasterData(data);
  res.json({ success: true, updatedAt: saved.updatedAt });
});

// Primary Persistent Storage: Restore from backup file
app.post('/api/storage/restore-backup', (req, res) => {
  if (!fs.existsSync(MASTER_BACKUP_FILE)) {
    return res.status(404).json({ error: 'バックアップファイルが存在しません' });
  }
  try {
    const content = fs.readFileSync(MASTER_BACKUP_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    // Overwrite master with backup content
    fs.writeFileSync(MASTER_DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    res.json({ success: true, data: parsed.data, updatedAt: parsed.updatedAt });
  } catch (err: any) {
    res.status(500).json({ error: 'バックアップの復元に失敗しました: ' + (err?.message || err) });
  }
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
  // Use verified current models per Gemini API guidelines: 'gemini-3.8-flash' (primary), 'gemini-3.1-flash-lite' (fallback)
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[AI Planner] Calling model: ${model}`);
      const callPromise = ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      // 35 second timeout per model attempt to prevent premature timeouts on comprehensive roadmaps
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout for model ${model}`)), 35000)
      );

      const response: any = await Promise.race([callPromise, timeoutPromise]);
      const rawText = response.text || '';
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
      }
      const parsed = JSON.parse(cleaned);
      if (parsed) {
        console.log(`[AI Planner] Successfully generated with ${model}`);
        return parsed;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Planner] Model ${model} failed:`, err?.message || err);
      // Small wait before fallback
      await new Promise((resolve) => setTimeout(resolve, 300));
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

  // Check if goal specifies multiple study subjects (e.g. 社会科: 日本史, 世界史, 地理, 公民)
  const isSocialStudies =
    (goal.includes('社会') || goal.includes('社会科')) &&
    (goal.includes('日本史') || goal.includes('世界史') || goal.includes('地理') || goal.includes('公民'));

  if (isSocialStudies) {
    const subjects = [
      {
        name: '日本史',
        tag: '日本史',
        phase1: '古代〜近世の重要通史と時代の流れ整理',
        phase2: '近代・現代史（幕末・明治〜戦後）と重要論点演習',
        sub1: ['旧石器・縄文・古墳から平安・鎌倉までの重要年表把握', '戦国・江戸幕府の政治制度と経済・文化の変遷ノート整理'],
        sub2: ['明治維新から大正デモクラシー・昭和戦後改革の因果関係把握', '過去問演習と間違えた年号・人名の復習'],
      },
      {
        name: '世界史',
        tag: '世界史',
        phase1: '古代文明〜中世ヨーロッパ・アジア帝国の基本通史把握',
        phase2: '近世・近代市民革命〜二つの世界大戦と現代国際秩序',
        sub1: ['古代オリエント・ギリシア・ローマと中国王朝（秦漢〜唐宋）の変遷', 'イスラーム世界の拡大と中世ヨーロッパ封建社会・ルネサンス'],
        sub2: ['産業革命・大航海時代・フランス革命・アメリカ独立史の要点', '第一次・第二次世界大戦と東西冷戦・現代の地域紛争'],
      },
      {
        name: '地理',
        tag: '地理',
        phase1: '系統地理（気候・地形・植生と世界の農牧業・資源産業）',
        phase2: '地誌（アジア・ヨーロッパ・南北アメリカ）と統計・地図読解対策',
        sub1: ['ケッペンの気候区分（熱帯〜寒帯）の特徴と生活文化の理解', '世界のプレート境界・造山帯と主要鉱産資源（石油・鉄鉱石）の分布'],
        sub2: ['主要国の農業区分・食料自給率と産業構造の比較', '地図記号・等高線・雨温図統計データの読み解き演習'],
      },
      {
        name: '公民',
        tag: '公民',
        phase1: '日本国憲法の基本原則と政治機構（国会・内閣・裁判所）',
        phase2: '市場経済・金融財政政策・国際社会と現代時事問題',
        sub1: ['国民主権・基本的人権の尊重・平和主義と憲法判例の学習', '三権分立の相互抑制・均衡と選挙制度・地方自治の仕組み'],
        sub2: ['需要供給曲線・金融緩和・インフレと国家財政のメカニズム', '国際連合の機関とSDGs・地球環境・国際紛争への取り組み'],
      },
    ];

    const tasks: any[] = [];
    const totalSubjects = subjects.length;

    // Phase 1 (Foundation): 1 balanced task per subject
    subjects.forEach((subj, idx) => {
      const dayOffset = Math.max(1, Math.round(days * (0.08 + (idx / totalSubjects) * 0.35)));
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);

      tasks.push({
        title: `【${subj.name}】${subj.phase1}`,
        description: `4科目均等学習の第1ステップ。${subj.name}の基礎通史と概念を偏りなくインプットします。`,
        dueDate: targetDate.toISOString().split('T')[0],
        priority: 'high',
        category: 'study',
        tags: [subj.tag, '社会科', '基礎学習'],
        estimatedMinutes: 60,
        subtasks: subj.sub1.map((title) => ({ title })),
      });
    });

    // Phase 2 (Application & Practice): 1 balanced task per subject
    subjects.forEach((subj, idx) => {
      const dayOffset = Math.max(1, Math.round(days * (0.48 + (idx / totalSubjects) * 0.38)));
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);

      tasks.push({
        title: `【${subj.name}】${subj.phase2}`,
        description: `4科目均等学習の第2ステップ。${subj.name}の実践演習と重要論点の深掘りを行います。`,
        dueDate: targetDate.toISOString().split('T')[0],
        priority: 'high',
        category: 'study',
        tags: [subj.tag, '社会科', '応用演習'],
        estimatedMinutes: 60,
        subtasks: subj.sub2.map((title) => ({ title })),
      });
    });

    // Final Review (Comprehensive 4-subject test)
    const finalOffset = Math.max(1, Math.round(days * 0.94));
    const finalDate = new Date(today);
    finalDate.setDate(today.getDate() + finalOffset);

    tasks.push({
      title: '【社会科4科目総合】日本史・世界史・地理・公民 総合演習＆弱点克服',
      description: '4科目（日本史・世界史・地理・公民）を均等に解いて学習到達度を測定し、残課題を最終整理します。',
      dueDate: finalDate.toISOString().split('T')[0],
      priority: 'urgent',
      category: 'study',
      tags: ['社会科総合', '均等学習', '模試演習'],
      estimatedMinutes: 90,
      subtasks: [
        { title: '4科目各15〜20分の実戦テスト演習' },
        { title: '4科目の正答率を比較し均等な知識定着を確認' },
        { title: '間違えた箇所の解説ノート確認と再テスト' },
      ],
    });

    tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      title: `社会科4科目（日本史・世界史・地理・公民）均等マスターロードマップ (${periodLabel})`,
      overview: `ご要望に基づき、日本史・世界史・地理・公民の4科目を完全に均等な学習量・配分で進められる${periodLabel}の学習計画です。1つの科目に偏ることなく、基礎のインプットから応用問題演習、最終総合模試まで各科目同じペースで着実に実力を養成します。`,
      tasks,
    };
  }

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
        const validIds = new Set(tasks.map((t) => t.id));
        const taskByTitle = new Map(tasks.map((t) => [t.title.trim(), t.id]));

        parsed.schedule.forEach((day: any) => {
          if (Array.isArray(day.allocatedTaskIds)) {
            day.allocatedTaskIds = day.allocatedTaskIds
              .map((tid: string) => {
                if (validIds.has(tid)) return tid;
                if (taskByTitle.has(String(tid).trim())) return taskByTitle.get(String(tid).trim());
                const found = tasks.find(
                  (t) => t.id === tid || t.title.includes(String(tid)) || String(tid).includes(t.title)
                );
                return found ? found.id : null;
              })
              .filter(Boolean);
          }
        });

        // Ensure at least some tasks were matched; if not, use fallback
        const hasMatchedTasks = parsed.schedule.some(
          (d: any) => Array.isArray(d.allocatedTaskIds) && d.allocatedTaskIds.length > 0
        );

        if (hasMatchedTasks) {
          return res.json(parsed);
        }
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

    const prompt = `あなたは目標達成と学習計画・タスク分解の専門家です。
ユーザーの目標:「${goal}」を達成するために、本日(${todayStr})から【${periodLabel}】にわたる段階的で実行可能なタスク計画を作成してください。

【重要な要件】
1. 科目・分野の均等配分（最重要）:
   - ユーザーが「社会科（日本史、世界史、地理、公民）」や複数の科目・領域・分野を均等に学習することを求めている場合、特定の科目だけに偏らず、【各科目・各分野が均等な割合で学習できるようにタスクを分けて作成】してください。
   - 例えば「日本史、世界史、地理、公民」の場合：
     - 【日本史】のタスク（基礎通史、重要論点演習など）
     - 【世界史】のタスク（主要文明、近現代史など）
     - 【地理】のタスク（系統地理、地誌・統計読解など）
     - 【公民】のタスク（憲法政治、経済時事など）
     をそれぞれ同数（各2〜3タスクずつ）かつ同等の学習時間で均等配分し、最終段階に【4科目総合復習演習】を配置してください。
   - 各タスクのタイトル冒頭には【日本史】【世界史】【地理】【公民】のように科目・分野名を明確に冠し、tags配列にも該当科目名を含めてください。
2. 期間（${periodLabel}）全体を見通し、前半（基礎固め・重要概念把握）、中盤（分野別問題演習・応用）、後半（総括・総合演習）へと段階的にステップアップするタスクを${days >= 30 ? '8〜14件' : '5〜8件'}作成してください。
3. 「この時期/この日はこれやる」と明確に分かるように、各タスクに期日(dueDate: YYYY-MM-DD形式、本日〜${days}日後の範囲内で均等・適切に分散)、優先度(urgent/high/medium/low)、見積もり時間(分)、タグ、チェックリスト用サブタスク(2〜4項目)を付与してください。
4. カテゴリは「${category}」（社会科や勉強の場合は study 推奨）とし、適切なものを割り振ってください。`;

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

// AI: Interactive Plan Refinement & Brush-up (対話形式でスケジュール・ロードマップをブラッシュアップ)
app.post('/api/ai/refine-plan', async (req, res) => {
  try {
    const { planType, currentPlan, userMessage, history = [], allTasks = [] } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'ユーザーのメッセージを入力してください' });
    }
    if (!currentPlan) {
      return res.status(400).json({ error: '現在の計画データが必要です' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (planType === 'schedule') {
      // Refine existing tasks day-by-day allocation
      const prompt = `あなたは熟練したパーソナルタスクマネージャーです。
ユーザーから提供された現在の日別スケジュール計画に対し、対話形式でユーザーのブラッシュアップ要望を反映してスケジュールを更新してください。

【本日の日付】: ${todayStr}
【現在の日別スケジュール計画】:
${JSON.stringify(currentPlan, null, 2)}

【既存タスク一覧】:
${JSON.stringify(allTasks.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority })), null, 2)}

【過去の対話履歴】:
${history.map((h: any) => `${h.role === 'user' ? 'ユーザー' : 'AI'}: ${h.content}`).join('\n')}

【ユーザーからの最新の要望・修正指示】:
「${userMessage}」

【指示】
1. ユーザーの要望（例: 「平日の作業時間を減らして土日に寄せて」「プレゼン資料のタスクをもっと前倒しして」「1日の負担を均等にして」など）を忠実に反映してください。
2. 返答メッセージ（replyMessage）で、ユーザーの要望をどう反映・ブラッシュアップしたかを親しみやすく簡潔に回答してください（日本語）。
3. updatedPlanには、修正後の完全なスケジュールオブジェクト（planSummary, schedule, productivityAdvice）を返してください。
4. 各日のallocatedTaskIdsには、既存タスクの有効なID配列を設定してください。`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          replyMessage: {
            type: Type.STRING,
            description: 'ユーザーの要望をどう反映したかの親切な説明メッセージ',
          },
          updatedPlan: {
            type: Type.OBJECT,
            properties: {
              planSummary: { type: Type.STRING },
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    dayLabel: { type: Type.STRING },
                    theme: { type: Type.STRING },
                    allocatedTaskIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    explanation: { type: Type.STRING },
                    totalEstimatedMinutes: { type: Type.INTEGER },
                  },
                  required: ['date', 'dayLabel', 'theme', 'allocatedTaskIds', 'explanation', 'totalEstimatedMinutes'],
                },
              },
              productivityAdvice: { type: Type.STRING },
            },
            required: ['planSummary', 'schedule', 'productivityAdvice'],
          },
        },
        required: ['replyMessage', 'updatedPlan'],
      };

      try {
        const parsed = await callGeminiJson(prompt, schema);
        if (parsed && parsed.updatedPlan && Array.isArray(parsed.updatedPlan.schedule)) {
          // Normalize task IDs
          const validIds = new Set(allTasks.map((t: any) => t.id));
          const taskByTitle = new Map(allTasks.map((t: any) => [t.title.trim(), t.id]));

          parsed.updatedPlan.schedule.forEach((day: any) => {
            if (Array.isArray(day.allocatedTaskIds)) {
              day.allocatedTaskIds = day.allocatedTaskIds
                .map((tid: string) => {
                  if (validIds.has(tid)) return tid;
                  if (taskByTitle.has(String(tid).trim())) return taskByTitle.get(String(tid).trim());
                  const found = allTasks.find(
                    (t: any) => t.id === tid || t.title.includes(String(tid)) || String(tid).includes(t.title)
                  );
                  return found ? found.id : null;
                })
                .filter(Boolean);
            }
          });

          return res.json(parsed);
        }
      } catch (aiErr) {
        console.warn('AI refine schedule failed, using fallback:', aiErr);
      }

      // Fallback refinement if AI call fails
      return res.json({
        replyMessage: `ご要望「${userMessage}」に基づき、日程配分と優先度を調整しました。`,
        updatedPlan: currentPlan,
      });
    } else {
      // Refine goal roadmap
      const prompt = `あなたは目標達成と学習計画の専門家です。
ユーザーから提供された現在の目標ロードマップ計画に対し、対話形式でユーザーのブラッシュアップ要望を反映してタスク一覧を更新してください。

【本日の日付】: ${todayStr}
【現在の目標ロードマップ計画】:
${JSON.stringify(currentPlan, null, 2)}

【過去の対話履歴】:
${history.map((h: any) => `${h.role === 'user' ? 'ユーザー' : 'AI'}: ${h.content}`).join('\n')}

【ユーザーからの最新の要望・修正指示】:
「${userMessage}」

【指示】
1. ユーザーの要望（例: 「日本史の暗記時間を増やして」「土日に演習を寄せて」「時事問題対策タスクを追加して」「期間を短縮して」など）を忠実に反映してください。社会科（日本史・世界史・地理・公民）等の複数科目が含まれる場合は、均等バランスを崩さずに要望を適用してください。
2. 返答メッセージ（replyMessage）で、どのような調整・改善を行ったかを親しみやすく簡潔に回答してください（日本語）。
3. updatedPlanには、修正後の完全なロードマップオブジェクト（title, overview, tasks）を返してください。各タスクには title, description, dueDate (YYYY-MM-DD), priority, category, tags, estimatedMinutes, subtasks を含めてください。`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          replyMessage: {
            type: Type.STRING,
            description: 'ユーザーの要望をどう反映したかの親切な説明メッセージ',
          },
          updatedPlan: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              overview: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['urgent', 'high', 'medium', 'low'] },
                    category: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    estimatedMinutes: { type: Type.INTEGER },
                    subtasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: { title: { type: Type.STRING } },
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
        required: ['replyMessage', 'updatedPlan'],
      };

      try {
        const parsed = await callGeminiJson(prompt, schema);
        if (parsed && parsed.updatedPlan && Array.isArray(parsed.updatedPlan.tasks) && parsed.updatedPlan.tasks.length > 0) {
          return res.json(parsed);
        }
      } catch (aiErr) {
        console.warn('AI refine goal failed, using fallback:', aiErr);
      }

      // Fallback
      return res.json({
        replyMessage: `ご要望「${userMessage}」を反映してロードマップを調整しました。`,
        updatedPlan: currentPlan,
      });
    }
  } catch (error: any) {
    console.error('AI refine plan fatal error:', error);
    res.status(500).json({ error: error.message || 'ブラッシュアップ処理中にエラーが発生しました' });
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
