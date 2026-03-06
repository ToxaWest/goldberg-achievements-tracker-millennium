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

    if (loading) return React.createElement('div', { style: { padding: '20px', color: 'white' } }, 'Loading...');
    if (!config?.interface_path) return React.createElement('div', { style: { padding: '20px', color: '#ccc' } }, 'Not configured for this game.');

    return React.createElement('div', { style: { padding: '20px', overflowY: 'auto', maxHeight: '100%' } },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' } },
            achievements.map((ach) => 
                React.createElement('div', { key: ach.name, style: { 
                    background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center',
                    opacity: ach.unlocked ? 1 : 0.5, filter: ach.unlocked ? 'none' : 'grayscale(0.8)'
                }}, 
                    React.createElement('img', { src: ach.unlocked ? ach.icon_path : ach.icongray_path, style: { width: '64px', height: '64px', marginRight: '15px' } }),
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

    const handleGameChange = async (appId: string) => {
        setSelectedAppId(appId);
        if (appId) {
            try {
                const config = await getGameConfig({ app_id: appId });
                setInterfacePath(config.interface_path || '');
                setStatusPath(config.status_path || '');
            } catch (e) { console.error(e); }
        } else {
            setInterfacePath('');
            setStatusPath('');
        }
    };

    const handleSave = async () => {
        await saveGameConfig({ app_id: selectedAppId, interface_path: interfacePath, status_path: statusPath });
        alert('Saved!');
    };

    return React.createElement('div', { style: { padding: '20px', color: 'white' } },
        React.createElement('h3', null, 'GSE Achievements Tracker'),
        React.createElement('select', { 
            value: selectedAppId, 
            onChange: (e: any) => handleGameChange(e.target.value), 
            style: { width: '100%', padding: '8px', background: '#222', color: 'white' } 
        },
            React.createElement('option', { value: "" }, "Select a game"),
            games.map(g => React.createElement('option', { key: g.appid, value: g.appid }, g.display_name))
        ),
        selectedAppId && React.createElement('div', { style: { marginTop: '15px' } },
            React.createElement('input', { 
                type: "text", placeholder: "Interface Path (achievements.json)", 
                value: interfacePath, 
                onChange: (e: any) => setInterfacePath(e.target.value), 
                style: { width: '100%', marginBottom: '10px', padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #333' } 
            }),
            React.createElement('input', { 
                type: "text", placeholder: "Status Path (achievements.json)", 
                value: statusPath, 
                onChange: (e: any) => setStatusPath(e.target.value), 
                style: { width: '100%', marginBottom: '10px', padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #333' } 
            }),
            React.createElement('button', { 
                onClick: handleSave, 
                style: { padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } 
            }, "Save")
        )
    );
};

export default definePlugin(() => {
    // AddTab Hook - We inject into LibraryAppDetails if possible
    Millennium.AddWindowCreateHook?.((context: any) => {
        if (context.m_strName === 'SP Desktop') {
            // Future logic to inject tab
        }
    });

    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        (window as any).SteamClient?.Notifications?.DisplayNotification("Achievement Unlocked!", data.name + "\n" + data.description, data.icon || "", "");
    });

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(PluginSettings, null),
    };
});
