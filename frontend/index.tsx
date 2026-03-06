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
                if (gameConfig?.interface_path) {
                    const data = await getAchievements({ app_id: appId });
                    setAchievements(data);
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetchData();
    }, [appId]);

    if (loading) return <div style={{ padding: '20px', color: 'white' }}>Loading...</div>;
    if (!config?.interface_path) return <div style={{ padding: '20px', color: '#ccc' }}>Not configured for this game.</div>;

    return (
        <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {achievements.map((ach) => (
                    <div key={ach.name} style={{ 
                        background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center',
                        opacity: ach.unlocked ? 1 : 0.5, filter: ach.unlocked ? 'none' : 'grayscale(0.8)'
                    }}>
                        <img src={ach.unlocked ? ach.icon_path : ach.icongray_path} style={{ width: '64px', height: '64px', marginRight: '15px' }} />
                        <div>
                            <div style={{ fontWeight: 'bold', color: 'white' }}>{ach.display_name}</div>
                            <div style={{ fontSize: '0.8em', color: '#aaa' }}>{ach.description}</div>
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

    React.useEffect(() => {
        const load = async () => {
            if ((window as any).SteamClient?.Apps?.GetList) {
                const list = await (window as any).SteamClient.Apps.GetList();
                setGames(list.filter((a: any) => a.is_installed).sort((a: any, b: any) => a.display_name.localeCompare(b.display_name)));
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        await saveGameConfig({ app_id: selectedAppId, interface_path: interfacePath, status_path: statusPath });
        alert('Saved!');
    };

    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h3>GSE Achievements Tracker</h3>
            <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', color: 'white' }}>
                <option value="">Select a game</option>
                {games.map(g => <option key={g.appid} value={g.appid}>{g.display_name}</option>)}
            </select>
            {selectedAppId && (
                <div style={{ marginTop: '15px' }}>
                    <input type="text" placeholder="Interface Path" value={interfacePath} onChange={e => setInterfacePath(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
                    <input type="text" placeholder="Status Path" value={statusPath} onChange={e => setStatusPath(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
                    <button onClick={handleSave}>Save</button>
                </div>
            )}
        </div>
    );
};

export default definePlugin(() => {
    Millennium.AddWindowCreateHook?.((context: any) => {
        if (!context.m_strName?.startsWith('SP ')) return;
    });

    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        (window as any).SteamClient?.Notifications?.DisplayNotification("Achievement!", data.name, data.icon || "", "");
    });

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <PluginSettings />,
    };
});
