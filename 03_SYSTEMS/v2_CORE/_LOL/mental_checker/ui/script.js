/**
 * Sovereign Mind - UI & Interaction Logic
 */

let currentMatchData = null;
let breathingTimer = null;
let breathingCycleInterval = null;

// ドキュメントロード時の初期化
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    
    // pywebviewのバインド完了を待って初期化
    if (typeof window.pywebview !== 'undefined') {
        initApp();
    } else {
        window.addEventListener('pywebviewready', () => {
            initApp();
        });
        
        // 通常のブラウザ等でのデバッグ用のフォールバック (1.5秒待ってもバインドされない場合)
        setTimeout(() => {
            if (typeof window.pywebview === 'undefined' || typeof window.pywebview.api === 'undefined') {
                setupMockApi();
                initApp();
            }
        }, 1500);
    }
});

// アプリの初期化と状態確認
async function initApp() {
    try {
        const config = await window.pywebview.api.get_config();
        
        if (config.unlocked) {
            showScreen("main-screen");
            if (config.riot_id) {
                document.getElementById("riot-id-input").value = config.riot_id;
                document.getElementById("status-text").innerText = `${config.riot_id} 監視中`;
                loadRecentStats();
            } else {
                // Riot ID未設定なら設定エリアを開く
                document.getElementById("settings-area").classList.add("active");
            }
            // Gemini API キーの設定
            if (config.gemini_key) {
                document.getElementById("gemini-key-input").value = config.gemini_key;
            }
        } else {
            showScreen("lock-screen");
        }
    } catch (e) {
        console.error("Initialization error:", e);
    }
}

// 画面切り替えユーティリティ
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add("active");
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // 1. パスコード解除
    document.getElementById("unlock-btn").addEventListener("click", unlockApp);
    document.getElementById("passcode-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") unlockApp();
    });

    // 2. 設定エリアのトグル
    document.getElementById("settings-toggle").addEventListener("click", () => {
        const area = document.getElementById("settings-area");
        area.classList.toggle("active");
    });

    // 3. 設定（Riot ID ＆ Gemini API Key）の保存
    document.getElementById("save-settings-btn").addEventListener("click", saveSettings);

    // 4. 最新戦績のロード
    document.getElementById("reload-stats-btn").addEventListener("click", loadRecentStats);

    // 5. 感情スライダーの数値同期
    setupSliderSync("survey-anger", "anger-val");
    setupSliderSync("survey-fatigue", "fatigue-val");
    setupSliderSync("survey-team", "team-val");

    // 6. 診断ボタン
    document.getElementById("survey-form").addEventListener("submit", (e) => {
        e.preventDefault();
        runDiagnosis();
    });

    // 7. 呼吸ガイド開始
    document.getElementById("start-breathing-btn").addEventListener("click", startBreathingSession);

    // 8. 結果からロビーへ戻る
    const backToMain = () => {
        resetBreathingSession();
        showScreen("main-screen");
        // 最新状態の監視を維持
        loadRecentStats();
    };
    document.getElementById("back-to-main-btn").addEventListener("click", backToMain);
    document.getElementById("result-back-arrow").addEventListener("click", backToMain);

    // 9. タブメニューの切り替え
    document.getElementById("tab-btn-diagnosis").addEventListener("click", (e) => {
        switchTab("diagnosis");
    });
    document.getElementById("tab-btn-history").addEventListener("click", (e) => {
        switchTab("history");
    });

    // 10. インゲーム対策ポップアップを閉じる
    document.getElementById("close-matchup-btn").addEventListener("click", () => {
        showScreen("main-screen");
    });
}

// スライダーの値とUIテキストの同期
function setupSliderSync(sliderId, textId) {
    const slider = document.getElementById(sliderId);
    const text = document.getElementById(textId);
    slider.addEventListener("input", (e) => {
        text.innerText = e.target.value;
    });
}

// 🔑 アプリのロック解除
async function unlockApp() {
    const passcode = document.getElementById("passcode-input").value;
    const errorDiv = document.getElementById("lock-error");
    
    if (!passcode) {
        errorDiv.innerText = "パスコードを入力してください。";
        errorDiv.style.display = "block";
        return;
    }

    try {
        const res = await window.pywebview.api.unlock_app(passcode);
        if (res.success) {
            errorDiv.style.display = "none";
            showScreen("main-screen");
            const config = await window.pywebview.api.get_config();
            if (config.riot_id) {
                document.getElementById("riot-id-input").value = config.riot_id;
                loadRecentStats();
            } else {
                document.getElementById("settings-area").classList.add("active");
            }
            if (config.gemini_key) {
                document.getElementById("gemini-key-input").value = config.gemini_key;
            }
        } else {
            errorDiv.innerText = res.message || "パスコードが違います。";
            errorDiv.style.display = "block";
        }
    } catch (e) {
        errorDiv.innerText = "通信中にエラーが発生しました。";
        errorDiv.style.display = "block";
    }
}

// 💾 設定の保存（Riot ID ＆ Gemini API Key）
async function saveSettings() {
    const riotId = document.getElementById("riot-id-input").value.trim();
    const geminiKey = document.getElementById("gemini-key-input").value.trim();
    const msgDiv = document.getElementById("settings-msg");
    
    if (!riotId || !riotId.includes("#")) {
        msgDiv.innerText = "Riot ID は Name#Tag 形式で入力してください。";
        msgDiv.className = "error-msg";
        msgDiv.style.display = "block";
        return;
    }

    try {
        const res = await window.pywebview.api.save_settings(riotId, geminiKey);
        if (res.success) {
            msgDiv.innerText = res.message;
            msgDiv.className = "info-msg";
            msgDiv.style.display = "block";
            document.getElementById("status-text").innerText = `${riotId} 監視中`;
            setTimeout(() => {
                document.getElementById("settings-area").classList.remove("active");
                msgDiv.style.display = "none";
            }, 1500);
            loadRecentStats();
        } else {
            msgDiv.innerText = res.message;
            msgDiv.className = "error-msg";
            msgDiv.style.display = "block";
        }
    } catch (e) {
        msgDiv.innerText = "保存中にエラーが発生しました。";
        msgDiv.className = "error-msg";
        msgDiv.style.display = "block";
    }
}

// 互換性のためのフォールバックメソッド
async function saveRiotId() {
    return saveSettings();
}

// 🎮 Riot APIから最新戦績を非同期でリクエストする（GUIフリーズ防止）
async function loadRecentStats() {
    const loading = document.getElementById("match-loading");
    const dataArea = document.getElementById("match-data-area");
    const submitBtn = document.getElementById("submit-check-btn");
    
    loading.style.display = "block";
    dataArea.innerHTML = "";
    submitBtn.disabled = true;

    try {
        const res = await window.pywebview.api.get_recent_stats();
        
        if (res.error) {
            loading.style.display = "none";
            dataArea.innerHTML = `<div class="no-data-placeholder text-center">${res.error}</div>`;
            return;
        }
        
        // res.status === "loading" の場合は、バックグラウンドでの取得完了を待つ
        console.log("Riot API load requested asynchronously...");
    } catch (e) {
        loading.style.display = "none";
        dataArea.innerHTML = `<div class="no-data-placeholder text-center">戦績のリクエストに失敗しました。</div>`;
    }
}

// 🌐 Python側から非同期取得完了時に呼ばれるコールバック（成功）
window.onStatsLoaded = function(stats) {
    const loading = document.getElementById("match-loading");
    const dataArea = document.getElementById("match-data-area");
    const submitBtn = document.getElementById("submit-check-btn");

    loading.style.display = "none";
    currentMatchData = stats;
    submitBtn.disabled = false;

    const match = stats.latest_match;
    const streakWarning = stats.losing_streak >= 2 
        ? `<div class="streak-warning"><span>⚠️ 連敗警告: 現在 <strong>${stats.losing_streak}連敗中</strong> です。ティルトに厳重な警戒が必要です！</span></div>` 
        : "";

    dataArea.innerHTML = `
        <div class="stat-box fade-in">
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">最新試合結果</span>
                    <span class="stat-value ${match.win ? 'win' : 'lose'}">${match.win ? 'VICTORY' : 'DEFEAT'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">チャンピオン</span>
                    <span class="stat-value">${match.champion_name}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">KDA (キル/デス/アシスト)</span>
                    <span class="stat-value">${match.kills} / <span style="color:var(--color-red)">${match.deaths}</span> / ${match.assists}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">CS / 試合時間</span>
                    <span class="stat-value">${match.cs} CS (${match.duration_min}分)</span>
                </div>
            </div>
            ${streakWarning}
        </div>
    `;
};

// 🌐 Python側から非同期取得失敗時に呼ばれるコールバック（失敗）
window.onStatsFailed = function(errorMsg) {
    const loading = document.getElementById("match-loading");
    const dataArea = document.getElementById("match-data-area");
    const submitBtn = document.getElementById("submit-check-btn");

    loading.style.display = "none";
    submitBtn.disabled = true;
    dataArea.innerHTML = `<div class="no-data-placeholder text-center">${errorMsg}</div>`;
};

// 🧠 ティルト判定の実行
async function runDiagnosis() {
    if (!currentMatchData) return;

    const anger = parseInt(document.getElementById("survey-anger").value);
    const fatigue = parseInt(document.getElementById("survey-fatigue").value);
    const team = parseInt(document.getElementById("survey-team").value);

    // 1. ティルトスコアの算出 (0-100)
    let score = 0;
    const match = currentMatchData.latest_match;

    // A. 戦績補正
    if (!match.win) {
        score += 15; // 敗北で+15点
    }
    score += match.deaths * 4; // 1デスにつき+4点

    // B. 連敗補正
    const streak = currentMatchData.losing_streak;
    if (streak === 1) score += 10;
    else if (streak === 2) score += 30;
    else if (streak >= 3) score += 50;

    // C. 感情アンケートスコア (Max 15 * 4 = 60点)
    const surveyScore = (anger + fatigue + team) * 4;
    score += surveyScore;

    // 範囲制限
    score = Math.min(100, Math.max(0, score));

    // 2. 判定閾値
    let resultType = "GREEN";
    let title = "メンタル良好です！";
    let desc = "自己管理能力がしっかりと保たれています。次のゲームも高い集中力で臨みましょう。Go Ranked!";
    
    if (score >= 40 && score < 70) {
        resultType = "YELLOW";
        title = "ややティルトの兆候あり";
        desc = "少し疲れ、またはイライラが検知されています。このままゲームに入ると、プレイの精度が落ちる危険性があります。5〜10分間の休憩を取り、心をリセットすることをお勧めします。";
    } else if (score >= 70) {
        resultType = "RED";
        title = "ティルト警告：プレイ非推奨";
        desc = "警告！ 感情的になっているか、過剰な疲労、または連敗による強いストレス状態が検出されました。これ以上のプレイはソロキューの連敗（ティルトダウン）を招く可能性が極めて高いです。必ず15分以上の休憩を取りましょう！";
    }

    // 3. UIへの反映
    const card = document.querySelector(".result-card");
    card.className = "glass-card result-card text-center fade-in " + resultType.toLowerCase();
    
    const badge = document.getElementById("result-badge");
    badge.innerText = resultType;
    badge.className = "result-badge " + resultType.toLowerCase();

    document.getElementById("result-title").innerText = title;
    document.getElementById("result-desc").innerText = desc;
    document.getElementById("score-num").innerText = score;

    // 円形プログレスのアニメーション
    const bar = document.getElementById("score-bar");
    const strokeDashoffset = 283 - (283 * score) / 100;
    bar.style.strokeDashoffset = strokeDashoffset;

    // 呼吸ガイドの表示切替
    const breathingArea = document.getElementById("breathing-area");
    if (resultType === "YELLOW" || resultType === "RED") {
        breathingArea.style.display = "block";
    } else {
        breathingArea.style.display = "none";
    }

    // 4. 履歴への診断結果の保存
    const record = {
        timestamp: new Date().toLocaleString("ja-JP"),
        champion_name: match.champion_name,
        win: match.win,
        kills: match.kills,
        deaths: match.deaths,
        assists: match.assists,
        anger: anger,
        fatigue: fatigue,
        team: team,
        score: score,
        result: resultType
    };
    try {
        await window.pywebview.api.save_diagnosis_to_history(record);
    } catch (e) {
        console.error("Failed to save diagnosis to history:", e);
    }

    // 5. AIアドバイスの非同期生成要求
    const adviceText = document.getElementById("advice-text");
    const adviceLoading = document.getElementById("advice-loading");
    
    adviceText.style.display = "none";
    adviceLoading.style.display = "block";
    
    try {
        await window.pywebview.api.get_ai_advice(match.deaths, match.win, anger, fatigue, team);
    } catch (e) {
        console.error("Failed to trigger AI advice:", e);
        adviceLoading.style.display = "none";
        adviceText.style.display = "block";
        adviceText.innerText = "AIアドバイスの要求に失敗しました。";
    }

    showScreen("result-screen");
}

// 🌐 AIアドバイスのコールバック (Pythonから呼ばれる)
window.onAdviceLoaded = function(advice) {
    const adviceText = document.getElementById("advice-text");
    const adviceLoading = document.getElementById("advice-loading");
    
    adviceLoading.style.display = "none";
    adviceText.style.display = "block";
    adviceText.innerText = advice;
};

window.onAdviceFailed = function(errorMsg) {
    const adviceText = document.getElementById("advice-text");
    const adviceLoading = document.getElementById("advice-loading");
    
    adviceLoading.style.display = "none";
    adviceText.style.display = "block";
    adviceText.innerText = errorMsg;
};

// ⚔️ 敵JG検知による対面JG対策画面のポップアップ (Pythonから呼ばれる)
window.onMatchupDetected = function(matchupInfo) {
    console.log("Matchup detected:", matchupInfo);
    
    document.getElementById("matchup-my-champ").innerText = matchupInfo.my_champ;
    document.getElementById("matchup-enemy-champ").innerText = matchupInfo.enemy_champ;
    document.getElementById("matchup-strategy-text").innerText = matchupInfo.strategy;
    
    // 対面対策ポップアップ画面を表示
    showScreen("matchup-screen");
};

// 🧘 マインドフルネス呼吸セッション
function startBreathingSession() {
    const btn = document.getElementById("start-breathing-btn");
    const circle = document.getElementById("breathing-circle");
    const text = document.getElementById("breathing-timer-text");
    const instruction = document.getElementById("breathing-instruction");

    btn.disabled = true;
    resetBreathingSession();

    let timeLeft = 60; // 1分セッション
    let cycleState = 0; // 0: 吸う, 1: 止める, 2: 吐く
    let cycleTime = 4;  // 各フェーズ 4秒

    instruction.innerText = "サークルの動きに合わせて呼吸を整えてください。";
    
    // 最初の状態を即座にセット
    setBreathingState("inhale", "吸って...", circle, text);

    breathingTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(breathingTimer);
            clearInterval(breathingCycleInterval);
            text.innerText = "COMPLETE";
            circle.className = "breathing-circle-inner";
            instruction.innerText = "リセット完了！心が落ち着きました。ロビーに戻りましょう。";
            btn.innerText = "もう一度セッションを行う";
            btn.disabled = false;
        }
    }, 1000);

    // 4秒ごとの呼吸サイクルフェーズ管理 (4秒吸う -> 4秒止める -> 4秒吐く)
    breathingCycleInterval = setInterval(() => {
        cycleState = (cycleState + 1) % 3;
        if (cycleState === 0) {
            setBreathingState("inhale", "吸って...", circle, text);
        } else if (cycleState === 1) {
            setBreathingState("hold", "止めて...", circle, text);
        } else {
            setBreathingState("exhale", "吐いて...", circle, text);
        }
    }, 4000);
}

function setBreathingState(className, label, circle, text) {
    circle.className = "breathing-circle-inner " + className;
    text.innerText = label;
}

function resetBreathingSession() {
    if (breathingTimer) clearInterval(breathingTimer);
    if (breathingCycleInterval) clearInterval(breathingCycleInterval);
    
    document.getElementById("breathing-timer-text").innerText = "READY";
    document.getElementById("breathing-circle").className = "breathing-circle-inner";
    document.getElementById("start-breathing-btn").disabled = false;
    document.getElementById("start-breathing-btn").innerText = "セッション開始 (1分)";
}

// バックエンドからの試合終了通知コールバック (Pythonからevaluate_jsで呼ばれる)
window.onMatchFinished = function() {
    console.log("🔔 Match finished notification received from Python backend!");
    
    // アラート音を再生（ブラウザの仕様によりユーザーインタラクションがないと鳴らない場合がある）
    try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav");
        audio.volume = 0.5;
        audio.play();
    } catch(e) {}
    
    // メイン画面に戻って最新の戦績をロード
    resetBreathingSession();
    showScreen("main-screen");
    loadRecentStats();
};

// --- タブ切り替えと統計計算 ---
function switchTab(tabName) {
    // ボタンのactive切り替え
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    // コンテンツのactive切り替え
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
    
    if (tabName === "diagnosis") {
        document.getElementById("tab-btn-diagnosis").classList.add("active");
        document.getElementById("diagnosis-content").classList.add("active");
    } else if (tabName === "history") {
        document.getElementById("tab-btn-history").classList.add("active");
        document.getElementById("history-content").classList.add("active");
        loadHistoryAndStats();
    }
}

async function loadHistoryAndStats() {
    const listArea = document.getElementById("history-list-area");
    listArea.innerHTML = `<div class="loading-spinner">履歴を取得中...</div>`;
    
    try {
        const history = await window.pywebview.api.get_history();
        
        if (!history || history.length === 0) {
            listArea.innerHTML = `<div class="no-data-placeholder">履歴データがありません。</div>`;
            updateStatsWidgets([]);
            return;
        }
        
        // 統計情報の更新
        updateStatsWidgets(history);
        
        // 履歴リストの描画
        let html = '<table class="history-table"><thead><tr>';
        html += '<th>日時</th><th>チャンプ</th><th>結果</th><th>KDA</th><th>感情 (怒/疲/不)</th><th>ティルト度</th>';
        html += '</tr></thead><tbody>';
        
        history.forEach(item => {
            const resultClass = item.result.toLowerCase(); // green/yellow/red
            const winText = item.win ? "WIN" : "LOSE";
            const winClass = item.win ? "win" : "lose";
            
            html += `<tr>
                <td>${item.timestamp}</td>
                <td><strong>${item.champion_name}</strong></td>
                <td><span class="stat-value ${winClass}">${winText}</span></td>
                <td>${item.kills} / <span style="color:var(--color-red)">${item.deaths}</span> / ${item.assists}</td>
                <td>${item.anger} / ${item.fatigue} / ${item.team}</td>
                <td><span class="badge-mini ${resultClass}">${item.score} (${item.result})</span></td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        listArea.innerHTML = html;
        
    } catch (e) {
        console.error("Failed to load history and stats:", e);
        listArea.innerHTML = `<div class="no-data-placeholder text-center">履歴の取得に失敗しました。</div>`;
    }
}

function updateStatsWidgets(history) {
    if (!history || history.length === 0) {
        document.getElementById("stats-tilt-rate").innerText = "0%";
        document.getElementById("stats-calm-winrate").innerText = "0%";
        document.getElementById("stats-tilt-winrate").innerText = "0%";
        return;
    }
    
    const total = history.length;
    // ティルト発生率 (Score 40以上)
    const tiltCount = history.filter(item => item.score >= 40).length;
    const tiltRate = Math.round((tiltCount / total) * 100);
    document.getElementById("stats-tilt-rate").innerText = `${tiltRate}%`;
    
    // 冷静時勝率 (anger 1-2)
    const calmGames = history.filter(item => item.anger <= 2);
    if (calmGames.length > 0) {
        const calmWins = calmGames.filter(item => item.win).length;
        const calmWinrate = Math.round((calmWins / calmGames.length) * 100);
        document.getElementById("stats-calm-winrate").innerText = `${calmWinrate}%`;
    } else {
        document.getElementById("stats-calm-winrate").innerText = "---";
    }
    
    // 苛立ち時勝率 (anger 3以上)
    const tiltGames = history.filter(item => item.anger >= 3);
    if (tiltGames.length > 0) {
        const tiltWins = tiltGames.filter(item => item.win).length;
        const tiltWinrate = Math.round((tiltWins / tiltGames.length) * 100);
        document.getElementById("stats-tilt-winrate").innerText = `${tiltWinrate}%`;
    } else {
        document.getElementById("stats-tilt-winrate").innerText = "---";
    }
}

// ==========================================================================
// 擬似 API (開発中のWebブラウザでのデバッグ用)
// ==========================================================================
function setupMockApi() {
    console.warn("⚠️ pywebview API is missing. Mock API loaded for browser testing.");
    
    let mockConfig = {
        riot_id: "Kazurin#4036",
        unlocked: false,
        gemini_key: "",
        history: []
    };

    window.pywebview = {
        api: {
            get_config: async () => mockConfig,
            unlock_app: async (passcode) => {
                if (passcode === "SOVEREIGN_MIND_777") {
                    mockConfig.unlocked = true;
                    return { success: true };
                }
                return { success: false, message: "パスコードが正しくありません。" };
            },
            save_settings: async (riot_id, gemini_key) => {
                mockConfig.riot_id = riot_id;
                mockConfig.gemini_key = gemini_key;
                return { success: true, message: "設定を保存しました。" };
            },
            save_riot_id: async (riot_id) => {
                mockConfig.riot_id = riot_id;
                return { success: true, message: "Riot IDを保存しました。" };
            },
            get_recent_stats: async () => {
                // 擬似的に遅延させてコールバックを起動する
                setTimeout(() => {
                    const mockData = {
                        success: true,
                        latest_match: {
                            match_id: "JP1_123456789",
                            win: false,
                            kills: 3,
                            deaths: 8,
                            assists: 4,
                            champion_name: "Viego",
                            cs: 264,
                            duration_min: 39
                        },
                        losing_streak: 3
                    };
                    if (window.onStatsLoaded) {
                        window.onStatsLoaded(mockData);
                    }
                }, 1000);
                return { status: "loading" };
            },
            get_ai_advice: async (deaths, win, anger, fatigue, team) => {
                setTimeout(() => {
                    const mockAdvice = "デス数が8と高めです。デスを重ねるとウェーブコントロールを失い、チームのティルトを加速させます。次の試合は視界確保を徹底し、セーフプレイに徹してください。";
                    if (window.onAdviceLoaded) {
                        window.onAdviceLoaded(mockAdvice);
                    }
                }, 1500);
                return { status: "loading" };
            },
            save_diagnosis_to_history: async (record) => {
                mockConfig.history.unshift(record);
                return { success: true };
            },
            get_history: async () => {
                return mockConfig.history;
            }
        }
    };
}
