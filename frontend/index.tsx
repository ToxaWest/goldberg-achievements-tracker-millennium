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
            if (!appId) return;
            setLoading(true);
            try {
                const gameConfig = await getGameConfig({ app_id: appId });
                setConfig(gameConfig);
                if (gameConfig?.interface_path) {
                    const data = await getAchievements({ app_id: appId });
                    setAchievements(data);
                }
            } catch (e) { console.error("GSE: Error in tab", e); }
            setLoading(false);
        };
        fetchData();
    }, [appId]);

    if (loading) return React.createElement('div', { style: { padding: '20px', color: 'white' } }, 'Loading Achievements...');
    if (!config?.interface_path) return React.createElement('div', { style: { padding: '20px', color: '#ccc' } }, 'Not configured. Please set paths in Plugin Settings.');

    return React.createElement('div', { style: { padding: '20px', overflowY: 'auto', maxHeight: '100%' } },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' } },
            achievements.map((ach) => 
                React.createElement('div', { key: ach.name, style: { 
                    background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center',
                    opacity: ach.unlocked ? 1 : 0.5, filter: ach.unlocked ? 'none' : 'grayscale(0.8)'
                }}, 
                    React.createElement('img', { 
                        src: ach.unlocked ? ach.icon_path : ach.icongray_path, 
                        style: { width: '64px', height: '64px', marginRight: '15px', borderRadius: '4px' },
                        onError: (e: any) => { e.target.src = 'https://community.cloudflare.steamstatic.com/public/images/apps/unknown.png'; }
                    }),
                    React.createElement('div', null,
                        React.createElement('div', { style: { fontWeight: 'bold', color: 'white' } }, ach.display_name),
                        React.createElement('div', { style: { fontSize: '0.8em', color: '#aaa' } }, ach.description)
                    )
                )
            )
        )
    );
};

const PluginSettings = () => {
    const [appId, setAppId] = React.useState('');
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [message, setMessage] = React.useState('');

    const handleLoadConfig = async () => {
        if (!appId) return;
        try {
            const config = await getGameConfig({ app_id: appId });
            setInterfacePath(config.interface_path || '');
            setStatusPath(config.status_path || '');
            setMessage(config.interface_path ? 'Config loaded.' : 'No saved config for this AppID.');
        } catch (e) { setMessage('Error loading config.'); }
    };

    const handleSave = async () => {
        if (!appId || !interfacePath || !statusPath) {
            setMessage('Please fill all fields.');
            return;
        }
        try {
            const res = await saveGameConfig({ app_id: appId, interface_path: interfacePath, status_path: statusPath });
            if (res.success) {
                setMessage('Saved successfully!');
            } else {
                setMessage('Failed to save to plugin folder.');
            }
        } catch (e) { setMessage('Error saving.'); }
    };

    return React.createElement('div', { style: { padding: '20px', color: 'white' } },
        React.createElement('h2', null, 'GSE Achievements Tracker'),
        
        React.createElement('div', { style: { marginTop: '20px' } },
            React.createElement('label', null, 'Steam AppID:'),
            React.createElement('div', { style: { display: 'flex', gap: '10px', marginTop: '5px' } },
                React.createElement('input', { 
                    type: "text", placeholder: "e.g. 123456", 
                    value: appId, 
                    onChange: (e: any) => setAppId(e.target.value), 
                    style: { flexGrow: 1, padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #333' } 
                }),
                React.createElement('button', { 
                    onClick: handleLoadConfig,
                    style: { padding: '8px 15px', background: '#444', color: 'white', border: 'none', cursor: 'pointer' }
                }, 'Load')
            )
        ),

        appId && React.createElement('div', { style: { marginTop: '20px' } },
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', null, 'Interface Path:'),
                React.createElement('input', { 
                    type: "text", 
                    value: interfacePath, 
                    onChange: (e: any) => setInterfacePath(e.target.value), 
                    style: { width: '100%', padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #333' } 
                })
            ),
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', null, 'Status Path:'),
                React.createElement('input', { 
                    type: "text", 
                    value: statusPath, 
                    onChange: (e: any) => setStatusPath(e.target.value), 
                    style: { width: '100%', padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #333' } 
                })
            ),
            React.createElement('button', { 
                onClick: handleSave, 
                style: { padding: '10px 25px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' } 
            }, "Save")
        ),
        message && React.createElement('div', { style: { marginTop: '15px', color: message.includes('Saved') ? '#4caf50' : '#ff9800' } }, message)
    );
};

export default definePlugin(() => {
    // Add tab hook
    Millennium.AddWindowCreateHook?.((context: any) => {
        if (context.m_strName !== 'SP Desktop') return;
        try {
            (Millennium as any).AddTab({
                name: "Achievements (GSE)",
                id: "gse-achievements-tab",
                view: "LibraryAppDetails",
                content: (props: any) => React.createElement(AchievementsTab, { appId: (Millennium as any).getAppId?.() })
            });
        } catch (e) {}
    });

    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        try {
            (window as any).SteamClient?.Notifications?.DisplayNotification("Achievement Unlocked!", data.name + "\n" + data.description, data.icon || "", "");
        } catch (e) {}
    });

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(PluginSettings, null),
    };
});
