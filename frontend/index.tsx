import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

// Shared component for game settings
const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [achievements, setAchievements] = React.useState<any[]>([]);

    const normalizePath = (path: string) => {
        return path.replace(/\\/g, '/').replace(/"/g, '').trim();
    };

    const handleBrowse = async (setter: (val: string) => void) => {
        try {
            const client = (window as any).SteamClient;
            if (client?.Window?.OpenFilePicker) {
                // Use the internal SteamClient file picker
                const path = await client.Window.OpenFilePicker("Select achievements.json", "", false);
                if (path) setter(normalizePath(path));
            } else {
                console.warn("GSE: SteamClient.Window.OpenFilePicker not found");
            }
        } catch (e) {
            console.error("GSE: Browse failed", e);
        }
    };

    const loadConfig = async () => {
        const config = await getGameConfig({ app_id: appId });
        setInterfacePath(config.interface_path || '');
        setStatusPath(config.status_path || '');
        const data = await getAchievements({ app_id: appId });
        setAchievements(data || []);
    };

    React.useEffect(() => {
        loadConfig();
    }, [appId]);

    const handleSave = async () => {
        if (!interfacePath || !statusPath) {
            alert("Please fill all fields.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await saveGameConfig({ 
                app_id: appId, 
                interface_path: normalizePath(interfacePath), 
                status_path: normalizePath(statusPath) 
            });

            if (res && res.success) {
                alert('✅ Saved successfully!');
                const data = await getAchievements({ app_id: appId });
                setAchievements(data || []);
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
            <h3 style={{ marginBottom: '15px' }}>GSE Achievements Tracker</h3>
            
            <Field label="Achievements Interface Path" description="Path to achievements.json (metadata)" icon={<IconsModule.Settings />}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <TextField 
                        value={interfacePath} 
                        onChange={(e:any)=>setInterfacePath(e.target.value)}
                    />
                    <DialogButton onClick={() => handleBrowse(setInterfacePath)}>📁</DialogButton>
                </div>
            </Field>

            <Field label="Achievements Status Path" description="Path to achievements.json (unlock status)" icon={<IconsModule.Settings />}>
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

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4>Preview ({achievements.length} achievements)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '0.75em', color: a.unlocked ? '#4caf50' : '#666' }}>
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

const injectGameDetails = () => {
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

const injectGameProperties = () => {
    // Game Properties sidebar
    const sidebar = document.querySelector('.pagedsettings_PagedSettingsSideBar_39tP5');
    if (sidebar && !sidebar.querySelector('.gse-settings-nav-item')) {
        const navItem = document.createElement('div');
        navItem.className = 'pagedsettings_PageListItem_28m-O gse-settings-nav-item';
        navItem.innerHTML = 'GSE Achievements';
        navItem.style.cursor = 'pointer';
        
        navItem.onclick = () => {
            // Unselect others
            sidebar.querySelectorAll('.pagedsettings_PageListItem_28m-O').forEach(el => el.classList.remove('pagedsettings_Active_2y_v7'));
            navItem.classList.add('pagedsettings_Active_2y_v7');
            
            // Inject content
            const contentArea = document.querySelector('.pagedsettings_PagedSettingsContent_32A37');
            if (contentArea) {
                // Find appId from URL or window title
                const appIdMatch = window.location.href.match(/appid=(\d+)/) || window.location.href.match(/\/app\/(\d+)/);
                const appId = appIdMatch ? appIdMatch[1] : (window as any).opener?.location.href.match(/\/app\/(\d+)/)?.[1];
                
                if (appId) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'gse-properties-content';
                    contentArea.innerHTML = ''; // Clear existing
                    contentArea.appendChild(contentDiv);
                    
                    const ReactDOM = (window as any).ReactDOM;
                    if (ReactDOM?.createRoot) {
                        ReactDOM.createRoot(contentDiv).render(<GSEGameSettings appId={appId} />);
                    } else if (ReactDOM?.render) {
                        ReactDOM.render(<GSEGameSettings appId={appId} />, contentDiv);
                    }
                }
            }
        };
        
        sidebar.appendChild(navItem);
    }
};

export default definePlugin(() => {
    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        try {
            (window as any).SteamClient?.Notifications?.DisplayNotification("GSE Achievement!", data.name, "", "");
        } catch (e) {}
    });

    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        // Main Steam window
        if (context.m_strTitle === 'Steam' || !context.m_strTitle) {
            const observer = new MutationObserver(() => {
                if (window.location.href.includes('/library/app/')) {
                    injectGameDetails();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
        // Game Properties window
        if (context.m_strTitle?.includes('Properties')) {
             const observer = new MutationObserver(() => {
                injectGameProperties();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

    // Fallback for current window
    setInterval(() => {
        if (window.location.href.includes('/library/app/')) {
            injectGameDetails();
        }
        if (document.querySelector('.pagedsettings_PagedSettingsSideBar_39tP5')) {
            injectGameProperties();
        }
    }, 2000);

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <div style={{padding: '20px'}}>Use Game Properties to configure achievements per game.</div>,
    };
});
