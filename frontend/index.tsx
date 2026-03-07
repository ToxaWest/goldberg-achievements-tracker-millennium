import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');
const getAllConfigs = callable<[], any>('get_all_configs');

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
        <div style={{ padding: '20px', color: 'white', backgroundColor: '#171a21', height: '100%', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '15px' }}>GSE Achievements Tracker (App ID: {appId})</h3>
            
            <Field label="Achievements Interface Path" description="Path to achievements.json (metadata)" icon={<IconsModule.Settings />}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <TextField 
                        value={interfacePath} 
                        onChange={(e:any)=>setInterfacePath(e.target.value)}
                    />
                    <DialogButton onClick={() => handleBrowse(setInterfacePath)} style={{ minWidth: '40px' }}>📁</DialogButton>
                </div>
            </Field>

            <Field label="Achievements Status Path" description="Path to achievements.json (unlock status)" icon={<IconsModule.Settings />}>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <TextField 
                        value={statusPath} 
                        onChange={(e:any)=>setStatusPath(e.target.value)}
                    />
                    <DialogButton onClick={() => handleBrowse(setStatusPath)} style={{ minWidth: '40px' }}>📁</DialogButton>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '5px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '0.75em', color: a.unlocked ? '#4caf50' : '#888', display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '5px' }}>{a.unlocked ? '✅' : '🔒'}</span> 
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.display_name || a.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const MainPluginSettings = () => {
    const [configs, setConfigs] = React.useState<any>({});
    const [selectedAppId, setSelectedAppId] = React.useState<string | null>(null);
    const [manualAppId, setManualAppId] = React.useState('');

    React.useEffect(() => {
        const load = async () => {
            const data = await getAllConfigs();
            setConfigs(data || {});
        };
        load();
    }, []);

    if (selectedAppId) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <DialogButton onClick={() => setSelectedAppId(null)} style={{ margin: '10px', alignSelf: 'flex-start' }}>← Back to List</DialogButton>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <GSEGameSettings appId={selectedAppId} />
                </div>
            </div>
        );
    }

    const appIds = Object.keys(configs);

    return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: '#171a21', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '10px' }}>GSE Achievements Tracker</h2>
            <p style={{ marginBottom: '20px', color: '#ccc' }}>Configure achievement tracking for each game individually. You can also find these settings in each game's Steam Properties window.</p>
            
            <div style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Configured Games</h3>
                {appIds.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No games configured yet. Open a game's properties to set it up or enter an App ID below.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {appIds.map(appId => (
                            <div key={appId} style={{ background: '#2a2e33', padding: '12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #3d4450' }}>
                                <span style={{ fontWeight: 'bold' }}>App ID: {appId}</span>
                                <DialogButton onClick={() => setSelectedAppId(appId)}>Edit Config</DialogButton>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '20px' }}>
                <h3 style={{ marginBottom: '10px' }}>Configure New Game</h3>
                <p style={{ marginBottom: '10px', fontSize: '0.9em', color: '#aaa' }}>Enter the Steam App ID to manually configure achievements for a game.</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <TextField 
                            value={manualAppId} 
                            onChange={(e: any) => setManualAppId(e.target.value)}
                        />
                    </div>
                    <DialogButton 
                        onClick={() => {
                            if (manualAppId.trim()) setSelectedAppId(manualAppId.trim());
                        }}
                        disabled={!manualAppId.trim()}
                    >
                        Configure
                    </DialogButton>
                </div>
            </div>
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

    if (!achievements || achievements.length === 0) return null;

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
                            textAlign: 'center', overflow: 'hidden', color: '#fff'
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
    // Robust selector for app details
    const container = document.querySelector('[class*="library_AppDetailsMain"]');
    if (container && !container.querySelector('.gse-achievements-injected')) {
        const appIdMatch = window.location.href.match(/\/app\/(\d+)/);
        const appId = appIdMatch ? appIdMatch[1] : null;
        
        if (appId) {
            const injectDiv = document.createElement('div');
            injectDiv.className = 'gse-achievements-injected';
            const target = container.querySelector('[class*="library_AppDetailsHeader"]');
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

const GSEConfigModal = ({ appId, onClose }: { appId: string; onClose: () => void }) => {
    return (
        <div 
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(3px)'
            }} 
            onClick={onClose}
        >
            <div 
                style={{
                    width: '600px', background: '#1e2127',
                    borderRadius: '4px', border: '1px solid #3d4450',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                    overflow: 'hidden', color: 'white',
                    animation: 'modalFadeIn 0.2s ease-out'
                }} 
                onClick={e => e.stopPropagation()}
            >
                <style>{`
                    @keyframes modalFadeIn {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', background: '#2a2e33', borderBottom: '1px solid #3d4450', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>GSE Achievements Tracker</div>
                    <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '24px', lineHeight: '1', color: '#888' }}>×</div>
                </div>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <GSEGameSettings appId={appId} />
                </div>
                <div style={{ padding: '15px', background: '#2a2e33', borderTop: '1px solid #3d4450', display: 'flex', justifyContent: 'flex-end' }}>
                    <DialogButton onClick={onClose}>Close</DialogButton>
                </div>
            </div>
        </div>
    );
};

const showGSEConfig = (appId: string) => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'gse-modal-root';
    document.body.appendChild(modalRoot);
    
    const onClose = () => {
        const ReactDOM = (window as any).ReactDOM;
        if (ReactDOM?.unmountComponentAtNode) {
            ReactDOM.unmountComponentAtNode(modalRoot);
        }
        modalRoot.remove();
    };

    const ReactDOM = (window as any).ReactDOM;
    if (ReactDOM?.createRoot) {
        ReactDOM.createRoot(modalRoot).render(<GSEConfigModal appId={appId} onClose={onClose} />);
    } else if (ReactDOM?.render) {
        ReactDOM.render(<GSEConfigModal appId={appId} onClose={onClose} />, modalRoot);
    }
};

const injectGameDetailsButton = () => {
    // Target the horizontal links bar
    const container = document.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (container && !container.querySelector('.gse-details-button')) {
        const appIdMatch = window.location.href.match(/\/app\/(\d+)/);
        const appId = appIdMatch ? appIdMatch[1] : null;
        if (!appId) return;

        // Find position for the new button
        const lastItem = container.lastElementChild as HTMLElement;
        let nextLeft = 0;
        if (lastItem) {
            const lastLeft = parseInt(lastItem.style.left || '0');
            // Steam uses absolute positioning with fixed offsets
            nextLeft = lastLeft + (lastItem.offsetWidth || 100) + 8;
        }

        const btnContainer = document.createElement('div');
        btnContainer.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
        btnContainer.style.left = `${nextLeft}px`;
        btnContainer.style.top = '0px';
        btnContainer.style.position = 'absolute';

        btnContainer.innerHTML = `
            <div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0">
                <div class="_1b6LYWVijW-9E4YV0keDWZ">
                    <span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span>
                </div>
            </div>
        `;
        
        btnContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGSEConfig(appId);
        });
        
        container.appendChild(btnContainer);
    }
};

const injectIntoGeneral = () => {
    // Try to find the General page by looking for text markers if class names are obfuscated
    const findTarget = () => {
        // Look for the "Launch Options" header which is unique to General tab
        const allElements = document.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            if ((el.innerText === 'Launch Options' || el.innerText === 'LAUNCH OPTIONS' || el.innerText === 'Steam Cloud') && el.offsetWidth > 0) {
                // Return the section container
                return el.closest('[class*="Section"]') || el.parentElement;
            }
        }
        // Fallback to class search
        return document.querySelector('[class*="GeneralPage"]') || 
               document.querySelector('[class*="gameproperties_GeneralPage"]');
    };

    const target = findTarget();

    if (target && !document.querySelector('.gse-general-injected')) {
        console.log("GSE: Target found, attempting injection...");
        
        let appId: string | null = new URLSearchParams(window.location.search).get('appid');
        
        if (!appId) {
            const pathMatch = window.location.href.match(/\/app\/(\d+)/) || window.location.href.match(/appid=(\d+)/);
            appId = pathMatch ? pathMatch[1] : null;
        }

        if (!appId) {
            // Last ditch effort: find App ID text in the document
            const bodyText = document.body.innerText;
            const appIdMatch = bodyText.match(/App ID:\s*(\d+)/i);
            appId = appIdMatch ? appIdMatch[1] : null;
        }

        console.log("GSE: AppID for injection:", appId);

        if (appId) {
            const injectDiv = document.createElement('div');
            injectDiv.className = 'gse-general-injected';
            injectDiv.style.margin = '20px 0';
            injectDiv.style.padding = '20px';
            injectDiv.style.background = 'rgba(0, 0, 0, 0.4)';
            injectDiv.style.borderRadius = '8px';
            injectDiv.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            
            // Prepend to the General page or insert before the target section
            if (target.parentElement && target.className.includes('Section')) {
                target.parentElement.insertBefore(injectDiv, target);
            } else {
                target.prepend(injectDiv);
            }

            const ReactDOM = (window as any).ReactDOM;
            if (ReactDOM) {
                try {
                    if (ReactDOM.createRoot) {
                        ReactDOM.createRoot(injectDiv).render(<GSEGameSettings appId={appId} />);
                    } else {
                        ReactDOM.render(<GSEGameSettings appId={appId} />, injectDiv);
                    }
                    console.log("GSE: Injection successful!");
                } catch (e) {
                    console.error("GSE: Render error:", e);
                }
            } else {
                console.error("GSE: ReactDOM not found in this window context");
            }
        }
    }
};

const injectGameProperties = () => {
    // Always attempt General tab injection first
    injectIntoGeneral();

    // Secondary sidebar tab
    const sidebar = document.querySelector('[class*="SideBar"]') || document.querySelector('[class*="sidebar"]');
    if (sidebar && !sidebar.querySelector('.gse-settings-nav-item')) {
        const navItem = document.createElement('div');
        // Find any existing list item to copy classes from
        const existingItem = sidebar.querySelector('[class*="PageListItem"]') || sidebar.querySelector('div[class*="_"]');
        
        navItem.className = (existingItem?.className || '') + ' gse-settings-nav-item';
        navItem.innerHTML = 'GSE Achievements';
        navItem.style.cursor = 'pointer';
        navItem.style.padding = '10px';
        
        navItem.onclick = () => {
            const contentArea = document.querySelector('[class*="PagedSettingsContent"]') || document.querySelector('[class*="Content"]');
            if (contentArea) {
                const appIdMatch = window.location.href.match(/appid=(\d+)/) || window.location.href.match(/\/app\/(\d+)/);
                const appId = appIdMatch ? appIdMatch[1] : null;
                
                if (appId) {
                    contentArea.innerHTML = '';
                    const contentDiv = document.createElement('div');
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
            (window as any).SteamClient?.Notifications?.DisplayNotification("GSE Achievement earned!", data.name, "", "");
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
            injectGameDetailsButton();
        }
        
        // Always try injecting into General if visible
        injectIntoGeneral();
        
        // Also check for the properties window
        if (document.querySelector('[class*="PagedSettingsSideBar"]') || 
            document.querySelector('[class*="pagedsettings_PagedSettingsSideBar"]')) {
            injectGameProperties();
        }
    }, 500);

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <MainPluginSettings />,
    };
});
