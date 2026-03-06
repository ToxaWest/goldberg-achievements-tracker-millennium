import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const PluginSettings = () => {
    const [appId, setAppId] = React.useState('');
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);

    const normalizePath = (path: string) => {
        return path.replace(/\\/g, '/').replace(/"/g, '').trim();
    };

    const handleBrowse = async (setter: (val: string) => void) => {
        try {
            const client = (window as any).SteamClient;
            if (client?.Window?.OpenFilePicker) {
                const path = await client.Window.OpenFilePicker("Select achievements.json", "", false);
                if (path) setter(normalizePath(path));
            } else {
                alert("File picker not supported. Please paste the path manually.");
            }
        } catch (e) {
            console.error("GSE: Browse failed", e);
        }
    };

    const refreshPreview = async (id: string) => {
        try {
            const data = await getAchievements({ app_id: id });
            setAchievements(data || []);
        } catch (e) { setAchievements([]); }
    };

    const handleLoad = async () => {
        const id = appId.trim();
        if (!id) return;
        const config = await getGameConfig({ app_id: id });
        setInterfacePath(config.interface_path || '');
        setStatusPath(config.status_path || '');
        if (config.interface_path) {
            refreshPreview(id);
        } else {
            setAchievements([]);
        }
    };

    const handleSave = async () => {
        const id = appId.trim();
        if (!id || !interfacePath || !statusPath) {
            alert("Please fill all fields.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await saveGameConfig({ 
                app_id: id, 
                interface_path: normalizePath(interfacePath), 
                status_path: normalizePath(statusPath) 
            });

            if (res && res.success) {
                alert('✅ Saved successfully!');
                refreshPreview(id);
            } else {
                alert('❌ Backend failed to save.');
            }
        } catch (e) {
            alert('❌ Error: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h3>GSE Achievements Tracker</h3>
            
            <div style={{ marginBottom: '20px' }}>
                <Field label="1. Steam AppID" description="Enter the Steam AppID of the game" icon={<IconsModule.Search />}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <TextField 
                            value={appId} 
                            onChange={(e:any)=>setAppId(e.target.value)}
                        />
                        <DialogButton onClick={handleLoad}>Load</DialogButton>
                    </div>
                </Field>
            </div>

            {appId && (
                <div>
                    <Field label="2. Achievements Interface Path" description="Path to achievements.json (metadata)" icon={<IconsModule.Settings />}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <TextField 
                                value={interfacePath} 
                                onChange={(e:any)=>setInterfacePath(e.target.value)}
                            />
                            <DialogButton onClick={() => handleBrowse(setInterfacePath)}>📁</DialogButton>
                        </div>
                    </Field>

                    <Field label="3. Achievements Status Path" description="Path to achievements.json (unlock status)" icon={<IconsModule.Settings />}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <TextField 
                                value={statusPath} 
                                onChange={(e:any)=>setStatusPath(e.target.value)}
                            />
                            <DialogButton onClick={() => handleBrowse(setStatusPath)}>📁</DialogButton>
                        </div>
                    </Field>

                    <DialogButton 
                        onClick={handleSave} 
                        disabled={isSaving}
                        style={{ width: '100%', marginTop: '10px' }} 
                    >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </DialogButton>
                </div>
            )}

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4>Found {achievements.length} achievements</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '5px' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '0.8em', color: a.unlocked ? '#4caf50' : '#666' }}>
                                {a.unlocked ? '✅ ' : '🔒 '} {a.display_name || a.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const GameDetailsAchievements = ({ appId }: { appId: string }) => {
    const [achievements, setAchievements] = React.useState<any[]>([]);

    React.useEffect(() => {
        const load = async () => {
            const data = await getAchievements({ app_id: appId });
            setAchievements(data || []);
        };
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, [appId]);

    if (achievements.length === 0) return null;

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div style={{ 
            background: 'rgba(0,0,0,0.4)', 
            padding: '15px', 
            borderRadius: '4px', 
            marginTop: '10px',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#eee', fontWeight: 'bold' }}>GSE Achievements</span>
                <span style={{ color: '#aaa' }}>{unlockedCount} / {achievements.length}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                {achievements.map(a => (
                    <div 
                        key={a.name} 
                        title={a.display_name || a.name}
                        style={{ 
                            width: '40px', height: '40px', background: '#222', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: a.unlocked ? '2px solid #4caf50' : '2px solid #444',
                            opacity: a.unlocked ? 1 : 0.4, flexShrink: 0, fontSize: '10px',
                            textAlign: 'center', overflow: 'hidden'
                        }}
                    >
                        {(a.display_name || a.name).substring(0, 3)}
                    </div>
                ))}
            </div>
        </div>
    );
};

const injectAchievements = () => {
    const container = document.querySelector('.library_AppDetailsMain_1YI_S');
    if (container && !container.querySelector('.gse-achievements-injected')) {
        const appIdMatch = window.location.href.match(/\/app\/(\d+)/);
        const appId = appIdMatch ? appIdMatch[1] : null;
        
        if (appId) {
            const injectDiv = document.createElement('div');
            injectDiv.className = 'gse-achievements-injected';
            const target = container.querySelector('.library_AppDetailsHeader_3oY8m');
            if (target) {
                target.parentNode?.insertBefore(injectDiv, target.nextSibling);
                const ReactDOM = (window as any).ReactDOM;
                if (ReactDOM?.createRoot) {
                    ReactDOM.createRoot(injectDiv).render(<GameDetailsAchievements appId={appId} />);
                } else if (ReactDOM?.render) {
                    ReactDOM.render(<GameDetailsAchievements appId={appId} />, injectDiv);
                }
            }
        }
    }
};

export default definePlugin(() => {
    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        try {
            (window as any).SteamClient?.Notifications?.DisplayNotification("GSE Achievement!", data.name, "", "");
        } catch (e) {}
    });

    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        if (context.m_strTitle === 'Steam' || !context.m_strTitle) {
            const observer = new MutationObserver(() => {
                if (window.location.href.includes('/library/app/')) {
                    injectAchievements();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

    if (window.location.href.includes('/library/app/')) {
        setTimeout(injectAchievements, 1000);
    }

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <PluginSettings />,
    };
});
