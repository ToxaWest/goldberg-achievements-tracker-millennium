import { Millennium, definePlugin, callable, IconsModule } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any[]>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], { success: boolean }>('save_game_config');

const PluginSettings = () => {
    const [appId, setAppId] = React.useState('');
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [message, setMessage] = React.useState('');

    const refreshPreview = async (id: string) => {
        try {
            const data = await getAchievements({ app_id: id });
            setAchievements(data || []);
        } catch (e) { setAchievements([]); }
    };

    const handleLoad = async () => {
        if (!appId) return;
        const config = await getGameConfig({ app_id: appId });
        setInterfacePath(config.interface_path || '');
        setStatusPath(config.status_path || '');
        if (config.interface_path) refreshPreview(appId);
        setMessage(config.interface_path ? 'Loaded.' : 'No saved config.');
    };

    const handleSave = async () => {
        const res = await saveGameConfig({ app_id: appId, interface_path: interfacePath, status_path: statusPath });
        if (res.success) {
            setMessage('Saved to disk!');
            refreshPreview(appId);
        } else setMessage('Error saving.');
    };

    return React.createElement('div', { style: { padding: '20px', color: 'white' } },
        React.createElement('h3', null, 'GSE Achievements Tracker'),
        React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px' } },
            React.createElement('input', { 
                placeholder: "Steam AppID", value: appId, onChange: (e:any)=>setAppId(e.target.value),
                style: { background: '#111', color: 'white', padding: '8px', border: '1px solid #333' }
            }),
            React.createElement('button', { onClick: handleLoad, style: { padding: '8px 15px' } }, 'Load/Refresh')
        ),
        appId && React.createElement('div', null,
            React.createElement('input', { 
                placeholder: "Interface Path", value: interfacePath, onChange: (e:any)=>setInterfacePath(e.target.value),
                style: { width: '100%', background: '#111', color: 'white', padding: '8px', marginBottom: '10px' }
            }),
            React.createElement('input', { 
                placeholder: "Status Path", value: statusPath, onChange: (e:any)=>setStatusPath(e.target.value),
                style: { width: '100%', background: '#111', color: 'white', padding: '8px', marginBottom: '10px' }
            }),
            React.createElement('button', { onClick: handleSave, style: { background: '#2196f3', color: 'white', padding: '10px 20px', border: 'none' } }, 'Save Configuration')
        ),
        message && React.createElement('div', { style: { marginTop: '10px', color: '#4caf50' } }, message),
        achievements.length > 0 && React.createElement('div', { style: { marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' } },
            React.createElement('h4', null, 'Preview (Found ' + achievements.length + ' achievements):'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' } },
                achievements.map(a => React.createElement('div', { key: a.name, style: { opacity: a.unlocked ? 1 : 0.3, fontSize: '0.8em' } }, 
                    (a.unlocked ? '✅ ' : '🔒 ') + (a.display_name || a.name)
                ))
            )
        )
    );
};

export default definePlugin(() => {
    // Tab Injection
    Millennium.AddWindowCreateHook?.((context: any) => {
        if (context.m_strName !== 'SP Desktop') return;
        try {
            (Millennium as any).AddTab({
                name: "Achievements (GSE)",
                id: "gse-achievements-tab",
                view: "LibraryAppDetails",
                content: (props: any) => React.createElement('div', { style: { color: 'white', padding: '20px' } }, 'GSE Tab Active')
            });
        } catch (e) {}
    });

    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        (window as any).SteamClient?.Notifications?.DisplayNotification("Achievement!", data.name, "", "");
    });

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(PluginSettings, null),
    };
});
