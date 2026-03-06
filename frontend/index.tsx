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
    const [isSaving, setIsSaving] = React.useState(false);

    const refreshPreview = async (id: string) => {
        console.log("GSE: Refreshing preview for", id);
        try {
            const data = await getAchievements({ app_id: id });
            console.log("GSE: Preview data received:", data);
            setAchievements(data || []);
        } catch (e) { 
            console.error("GSE: Preview refresh failed", e);
            setAchievements([]); 
        }
    };

    const handleLoad = async () => {
        const id = appId.trim();
        if (!id) {
            alert("Please enter an AppID first.");
            return;
        }
        console.log("GSE: Loading config for", id);
        try {
            const config = await getGameConfig({ app_id: id });
            setInterfacePath(config.interface_path || '');
            setStatusPath(config.status_path || '');
            if (config.interface_path) {
                refreshPreview(id);
                setMessage('Configuration loaded.');
            } else {
                setAchievements([]);
                setMessage('No saved config for this ID.');
            }
        } catch (e) {
            console.error("GSE: Load failed", e);
            setMessage('Error connecting to backend.');
        }
    };

    const handleSave = async () => {
        const id = appId.trim();
        if (!id || !interfacePath || !statusPath) {
            alert("Please fill in all fields (AppID, Interface Path, and Status Path).");
            return;
        }

        console.log("GSE: Saving configuration...");
        setIsSaving(true);
        setMessage('Saving...');

        try {
            const res = await saveGameConfig({ 
                app_id: id, 
                interface_path: interfacePath.trim(), 
                status_path: statusPath.trim() 
            });

            console.log("GSE: Save result:", res);

            if (res && res.success) {
                setMessage('✅ Saved successfully!');
                alert('Configuration saved to settings.json');
                refreshPreview(id);
            } else {
                setMessage('❌ Backend failed to save file.');
                alert('Error: Backend could not write the settings file.');
            }
        } catch (e) {
            console.error("GSE: Save error", e);
            setMessage('❌ Critical error during save.');
            alert('Critical Error: Check dev console (F12).');
        } finally {
            setIsSaving(false);
        }
    };

    return React.createElement('div', { style: { padding: '20px', color: 'white' } },
        React.createElement('h3', null, 'GSE Achievements Tracker'),
        
        React.createElement('div', { style: { background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px' } },
            React.createElement('label', { style: { display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#ccc' } }, '1. Enter Game AppID:'),
            React.createElement('div', { style: { display: 'flex', gap: '10px' } },
                React.createElement('input', { 
                    placeholder: "e.g. 123456", 
                    value: appId, 
                    onChange: (e:any)=>setAppId(e.target.value),
                    style: { flexGrow: 1, background: '#111', color: 'white', padding: '10px', border: '1px solid #333', borderRadius: '4px' }
                }),
                React.createElement('button', { 
                    onClick: handleLoad, 
                    style: { padding: '10px 20px', background: '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } 
                }, 'Load Settings')
            )
        ),

        appId && React.createElement('div', { style: { background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' } },
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#ccc' } }, '2. Path to achievements.json (Interface):'),
                React.createElement('input', { 
                    placeholder: "steam_settings/achievements.json", 
                    value: interfacePath, 
                    onChange: (e:any)=>setInterfacePath(e.target.value),
                    style: { width: '100%', background: '#111', color: 'white', padding: '10px', border: '1px solid #333', borderRadius: '4px', boxSizing: 'border-box' }
                })
            ),
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#ccc' } }, '3. Path to achievements.json (Status/Saves):'),
                React.createElement('input', { 
                    placeholder: "AppData/Roaming/Goldberg.../achievements.json", 
                    value: statusPath, 
                    onChange: (e:any)=>setStatusPath(e.target.value),
                    style: { width: '100%', background: '#111', color: 'white', padding: '10px', border: '1px solid #333', borderRadius: '4px', boxSizing: 'border-box' }
                })
            ),
            React.createElement('button', { 
                onClick: handleSave, 
                disabled: isSaving,
                style: { 
                    width: '100%', 
                    background: isSaving ? '#555' : '#2196f3', 
                    color: 'white', 
                    padding: '12px', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: isSaving ? 'default' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1em'
                } 
            }, isSaving ? 'Saving...' : 'Save Configuration')
        ),

        message && React.createElement('div', { 
            style: { marginTop: '15px', padding: '10px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: message.includes('✅') ? '#4caf50' : '#ff9800' } 
        }, message),

        achievements.length > 0 && React.createElement('div', { style: { marginTop: '25px', borderTop: '1px solid #333', paddingTop: '15px' } },
            React.createElement('h4', { style: { marginBottom: '10px' } }, 'Achievements Preview (' + achievements.length + ' found):'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' } },
                achievements.map(a => React.createElement('div', { 
                    key: a.name, 
                    style: { 
                        padding: '8px', 
                        background: 'rgba(255,255,255,0.03)', 
                        borderRadius: '4px',
                        opacity: a.unlocked ? 1 : 0.4, 
                        fontSize: '0.85em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    } 
                }, 
                    React.createElement('span', null, a.unlocked ? '✅' : '🔒'),
                    React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.display_name || a.name)
                ))
            )
        )
    );
};

export default definePlugin(() => {
    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        try {
            (window as any).SteamClient?.Notifications?.DisplayNotification("GSE Achievement!", data.name, "", "");
        } catch (e) {}
    });

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(PluginSettings, null),
    };
});
