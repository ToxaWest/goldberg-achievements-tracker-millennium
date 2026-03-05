import { Millennium, definePlugin, callable, IconsModule } from '@steambrew/client';
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

// Declare backend methods
const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], Achievement[]>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], { success: boolean }>('save_game_config');

const AchievementsTab = ({ appId }: { appId: string }) => {
    const [achievements, setAchievements] = React.useState<Achievement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [config, setConfig] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const gameConfig = await getGameConfig({ app_id: appId });
                setConfig(gameConfig);
                
                if (gameConfig && gameConfig.interface_path) {
                    const data = await getAchievements({ app_id: appId });
                    setAchievements(data);
                }
            } catch (e) {
                console.error("GSE Achievements: Error fetching data", e);
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
            try {
                if ((window as any).SteamClient?.Apps?.GetList) {
                    const list = await (window as any).SteamClient.Apps.GetList();
                    setGames(list.filter((app: any) => app.is_installed).sort((a: any, b: any) => a.display_name.localeCompare(b.display_name)));
                }
            } catch (e) {
                console.error("GSE Achievements: Error getting app list", e);
            }
        };
        loadGames();
    }, []);

    const handleGameChange = async (appId: string) => {
        setSelectedAppId(appId);
        if (appId) {
            try {
                const config = await getGameConfig({ app_id: appId });
                setInterfacePath(config.interface_path || '');
                setStatusPath(config.status_path || '');
            } catch (e) {
                console.error("GSE Achievements: Error loading config", e);
            }
        }
        setMessage('');
    };

    const handleSave = async () => {
        if (!selectedAppId || !interfacePath || !statusPath) {
            setMessage('Please select a game and fill both paths');
            return;
        }
        try {
            const res = await saveGameConfig({ 
                app_id: selectedAppId, 
                interface_path: interfacePath, 
                status_path: statusPath 
            });
            if (res.success) {
                setMessage('Saved successfully!');
            }
        } catch (e) {
            setMessage('Error calling backend');
        }
    };

    return (
        <div style={{ padding: '20px', color: '#eee', maxWidth: '800px' }}>
            <h2>GSE Achievements Tracker</h2>
            <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Select Game:</label>
                <select 
                    value={selectedAppId} 
                    onChange={(e) => handleGameChange(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#2a2a2a', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                >
                    <option value="">-- Choose an installed game --</option>
                    {games.map(game => (
                        <option key={game.appid} value={game.appid}>{game.display_name}</option>
                    ))}
                </select>
            </div>

            {selectedAppId && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Interface Path:</label>
                        <input 
                            type="text" 
                            value={interfacePath} 
                            onChange={(e) => setInterfacePath(e.target.value)} 
                            style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: 'white', border: '1px solid #333' }}
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Status Path:</label>
                        <input 
                            type="text" 
                            value={statusPath} 
                            onChange={(e) => setStatusPath(e.target.value)} 
                            style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: 'white', border: '1px solid #333' }}
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        style={{ padding: '12px 24px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Save
                    </button>
                    {message && <div style={{ marginTop: '15px' }}>{message}</div>}
                </div>
            )}
        </div>
    );
};

export default definePlugin(() => {
    console.log("GSE Achievements: Injected successfully.");

    // Remove direct AddTab/AddSettingsPage calls from definePlugin as they might crash CEF if undefined
    // Instead, rely on the returned object which is the standard way in v2.

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <PluginSettings />,
    };
});
