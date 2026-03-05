import { Millennium, definePlugin } from '@steambrew/client';
import React from 'react';

interface Achievement {
    name: string;
    display_name: string;
    description: string;
    unlocked: boolean;
    unlock_time: number;
    icon_path?: string;
    icongray_path?: string;
}

const AchievementsTab = ({ appId }: { appId: string }) => {
    const [achievements, setAchievements] = React.useState<Achievement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [config, setConfig] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const gameConfig = await Millennium.callServerMethod('get_game_config', { app_id: appId });
            setConfig(gameConfig);
            
            if (gameConfig && gameConfig.interface_path) {
                const data = await Millennium.callServerMethod('get_achievements', { app_id: appId });
                setAchievements(data);
            }
            setLoading(false);
        };
        fetchData();
    }, [appId]);

    if (loading) return <div style={{ padding: '20px' }}>Loading Achievements...</div>;

    if (!config || !config.interface_path) {
        return (
            <div style={{ padding: '20px', color: '#ccc' }}>
                <h3>No Achievements Configured</h3>
                <p>Please configure the achievement paths in the plugin settings for this game.</p>
                <p style={{ fontSize: '0.8em', color: '#888' }}>Paths are set in: Millennium Settings &rarr; GSE Achievements</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '15px' }}>
                {achievements.map((ach) => (
                    <div key={ach.name} style={{ 
                        background: 'rgba(0,0,0,0.4)', 
                        padding: '12px', 
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid rgba(255,255,255,0.05)',
                        opacity: ach.unlocked ? 1 : 0.5,
                        filter: ach.unlocked ? 'none' : 'grayscale(0.8)'
                    }}>
                        <div style={{ position: 'relative', width: '64px', height: '64px', marginRight: '15px', flexShrink: 0 }}>
                            <img 
                                src={ach.unlocked ? ach.icon_path : ach.icongray_path} 
                                style={{ width: '100%', height: '100%', borderRadius: '6px' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://community.cloudflare.steamstatic.com/public/images/apps/unknown.png'; }}
                            />
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ach.display_name}</div>
                            <div style={{ fontSize: '0.9em', color: '#bbb', lineHeight: '1.2', marginTop: '2px' }}>{ach.description}</div>
                            {ach.unlocked && (
                                <div style={{ fontSize: '0.8em', color: '#4caf50', marginTop: '6px', fontWeight: 'bold' }}>
                                    ✓ Unlocked: {new Date(ach.unlock_time * 1000).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PluginSettings = () => {
    const [games, setGames] = React.useState<any[]>([]);
    const [selectedAppId, setSelectedAppId] = React.useState('');
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [message, setMessage] = React.useState('');

    React.useEffect(() => {
        const loadGames = async () => {
            if ((window as any).SteamClient?.Apps?.GetList) {
                const list = await (window as any).SteamClient.Apps.GetList();
                setGames(list.filter((app: any) => app.is_installed).sort((a: any, b: any) => a.display_name.localeCompare(b.display_name)));
            }
        };
        loadGames();
    }, []);

    const handleGameChange = async (appId: string) => {
        setSelectedAppId(appId);
        if (appId) {
            const config = await Millennium.callServerMethod('get_game_config', { app_id: appId });
            setInterfacePath(config.interface_path || '');
            setStatusPath(config.status_path || '');
        } else {
            setInterfacePath('');
            setStatusPath('');
        }
        setMessage('');
    };

    const handleSave = async () => {
        if (!selectedAppId || !interfacePath || !statusPath) {
            setMessage('Please select a game and fill both paths');
            return;
        }
        const res = await Millennium.callServerMethod('save_game_config', { 
            app_id: selectedAppId, 
            interface_path: interfacePath, 
            status_path: statusPath 
        });
        if (res.success) {
            setMessage('Saved successfully!');
        } else {
            setMessage('Error saving config');
        }
    };

    return (
        <div style={{ padding: '20px', color: '#eee', maxWidth: '800px' }}>
            <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>Goldberg Achievements Tracker</h2>
            
            <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Select Game:</label>
                <select 
                    value={selectedAppId} 
                    onChange={(e) => handleGameChange(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#2a2a2a', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                >
                    <option value="">-- Choose an installed game --</option>
                    {games.map(game => (
                        <option key={game.appid} value={game.appid}>{game.display_name} ({game.appid})</option>
                    ))}
                </select>
            </div>

            {selectedAppId && (
                <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Achievements Interface Path (achievements.json):</label>
                        <input 
                            type="text" 
                            value={interfacePath} 
                            onChange={(e) => setInterfacePath(e.target.value)} 
                            placeholder="D:\Games\MyGame\steam_settings\achievements.json"
                            style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: 'white', border: '1px solid #333', borderRadius: '4px' }}
                        />
                        <small style={{ color: '#888' }}>Usually found in the game's folder inside steam_settings/</small>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Achievements Status Path (AppData/.../achievements.json):</label>
                        <input 
                            type="text" 
                            value={statusPath} 
                            onChange={(e) => setStatusPath(e.target.value)} 
                            placeholder="C:\Users\Name\AppData\Roaming\Goldberg SteamEmu Saves\123456\achievements.json"
                            style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: 'white', border: '1px solid #333', borderRadius: '4px' }}
                        />
                        <small style={{ color: '#888' }}>Found in %AppData%/Goldberg SteamEmu Saves/{"{AppID}"}/</small>
                    </div>

                    <button 
                        onClick={handleSave}
                        style={{ 
                            padding: '12px 24px', 
                            background: '#2196f3', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            marginTop: '10px'
                        }}
                    >
                        Save Configuration
                    </button>
                    {message && <div style={{ marginTop: '15px', padding: '10px', background: message.includes('Error') ? '#d32f2f' : '#388e3c', borderRadius: '4px' }}>{message}</div>}
                </div>
            )}

            {!selectedAppId && (
                <div style={{ marginTop: '40px', textAlign: 'center', color: '#777' }}>
                    <p>Select a game to start configuring achievement tracking.</p>
                </div>
            )}
        </div>
    );
};

export default definePlugin(() => {
    // Add tab to Library Game Details (Desktop)
    const addAchievementsTab = () => {
        (Millennium as any).AddTab({
            name: "Achievements (GSE)",
            id: "gse-achievements-tab",
            view: "LibraryAppDetails",
            content: <AchievementsTab appId={(Millennium as any).getAppId()} />
        });
    };

    addAchievementsTab();

    // Add settings entry
    (Millennium as any).AddSettingsPage({
        name: "GSE Achievements",
        content: <PluginSettings />
    });

    // Support for Big Picture Overlay and other windows
    (Millennium as any).onWindowCreated((window: any) => {
        if (window.title === "Steam" || window.url?.includes("steamui")) {
            console.log("New Steam UI window detected, ensuring tab is added.");
            addAchievementsTab();
        }
    });

    // Listen for achievements earned from backend
    (Millennium as any).onServerEvent('achievement_earned', (data: any) => {
        const { name, description, icon } = data;
        
        if ((window as any).SteamClient?.Notifications?.DisplayNotification) {
            (window as any).SteamClient.Notifications.DisplayNotification(
                "Achievement Unlocked!",
                name + "\n" + description,
                icon || "",
                "" // sound
            );
        } else {
            console.log("Achievement Earned:", name, description);
        }
    });

    return {
        title: "Goldberg Achievements Tracker",
        icon: <div />, // Placeholder
    } as any;
});
