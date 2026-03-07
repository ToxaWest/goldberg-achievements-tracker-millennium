import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');
const getAllConfigs = callable<[], any>('get_all_configs');

const LOG_PREFIX = "[GSE]";
const log = (...args: any[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: any[]) => console.warn(LOG_PREFIX, ...args);

const getAppId = async (doc: Document) => {
    const win = (doc.defaultView || window) as any;
    
    // 1. Try MainWindowBrowserManager
    if (win.MainWindowBrowserManager?.m_lastLocation?.pathname) {
        const match = win.MainWindowBrowserManager.m_lastLocation.pathname.match(/\/app\/(\d+)/);
        if (match) {
            log("AppId from MainWindowBrowserManager:", match[1]);
            return match[1];
        }
    }

    // 2. Try SteamClient.Apps.GetActiveAppID
    if (win.SteamClient?.Apps?.GetActiveAppID) {
        try {
            const appId = await win.SteamClient.Apps.GetActiveAppID();
            if (appId && appId > 0) {
                log("AppId from SteamClient:", appId);
                return String(appId);
            }
        } catch (e) {}
    }

    // 3. Try URL parsing
    const urlParams = new URLSearchParams(win.location.search);
    let appId = urlParams.get('appid') || urlParams.get('appId');
    if (appId) {
        log("AppId from URL search params:", appId);
        return appId;
    }

    const match = win.location.href.match(/\/app\/(\d+)/) || win.location.href.match(/appid=(\d+)/);
    if (match) {
        log("AppId from URL href:", match[1]);
        return match[1];
    }

    // 4. Image-based detection (HLTB's strategy)
    const appIdPattern = /\/assets\/(\d+)/;
    const images = doc.querySelectorAll('img[src*="/assets/"]');
    for (const img of Array.from(images) as HTMLImageElement[]) {
        const imgMatch = img.src.match(appIdPattern);
        if (imgMatch) {
            log("AppId from image asset:", imgMatch[1]);
            return imgMatch[1];
        }
    }
    
    const heroMatch = doc.querySelector('img[src*="library_hero"]')?.getAttribute('src')?.match(appIdPattern);
    if (heroMatch) {
        log("AppId from hero image:", heroMatch[1]);
        return heroMatch[1];
    }
    
    return null;
};

const getGameName = (appId: string) => {
    try {
        const overview = (window as any).appStore?.GetAppOverviewByAppID(parseInt(appId));
        return overview?.display_name || `App ${appId}`;
    } catch (e) {
        return `App ${appId}`;
    }
};

const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const gameName = getGameName(appId);

    const normalizePath = (path: string) => path.replace(/\\/g, '/').replace(/"/g, '').trim();

    const handleBrowse = async (setter: (val: string) => void) => {
        try {
            const client = (window as any).SteamClient;
            if (client?.Window?.OpenFilePicker) {
                const path = await client.Window.OpenFilePicker("Select achievements.json", "", false);
                if (path) setter(normalizePath(path));
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

    React.useEffect(() => { loadConfig(); }, [appId]);

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
                const data = await getAchievements({ app_id: appId });
                setAchievements(data || []);
            }
        } catch (e) {
            alert('❌ Error: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: '#171a21', height: '100%', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '15px' }}>{gameName}</h3>
            <Field label="Interface Path" description="Path to achievements.json (metadata)" icon={<IconsModule.Settings />}>
                <div style={{ display: 'flex', gap: '5px' }}><TextField value={interfacePath} onChange={(e:any)=>setInterfacePath(e.target.value)} /><DialogButton onClick={() => handleBrowse(setInterfacePath)}>📁</DialogButton></div>
            </Field>
            <Field label="Status Path" description="Path to achievements.json (unlock status)" icon={<IconsModule.Settings />}>
                <div style={{ display: 'flex', gap: '5px' }}><TextField value={statusPath} onChange={(e:any)=>setStatusPath(e.target.value)} /><DialogButton onClick={() => handleBrowse(setStatusPath)}>📁</DialogButton></div>
            </Field>
            <DialogButton onClick={handleSave} disabled={isSaving} style={{ width: '100%', marginTop: '10px' }}>{isSaving ? 'Saving...' : 'Save Configuration'}</DialogButton>
            {achievements.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4>{achievements.length} Achievements</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '5px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                        {achievements.map(a => (<div key={a.name} style={{ fontSize: '0.75em', color: a.unlocked ? '#4caf50' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.unlocked ? '✅' : '🔒'} {a.display_name || a.name}</div>))}
                    </div>
                </div>
            )}
        </div>
    );
};

const showGSEConfig = (appId: string) => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'gse-modal-root';
    document.body.appendChild(modalRoot);
    const onClose = () => {
        const ReactDOM = (window as any).ReactDOM;
        if (ReactDOM?.unmountComponentAtNode) ReactDOM.unmountComponentAtNode(modalRoot);
        modalRoot.remove();
    };
    const ReactDOM = (window as any).ReactDOM;
    if (ReactDOM?.createRoot) {
        ReactDOM.createRoot(modalRoot).render(<GSEConfigModal appId={appId} onClose={onClose} />);
    } else if (ReactDOM?.render) {
        ReactDOM.render(<GSEConfigModal appId={appId} onClose={onClose} />, modalRoot);
    }
};

const GSEConfigModal = ({ appId, onClose }: { appId: string; onClose: () => void }) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }} onClick={onClose}>
        <div style={{ width: '600px', background: '#1e2127', borderRadius: '4px', border: '1px solid #3d4450', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', overflow: 'hidden', color: 'white' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', background: '#2a2e33', borderBottom: '1px solid #3d4450', alignItems: 'center' }}>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>GSE Achievements Tracker</div>
                <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '24px', lineHeight: '1', color: '#888' }}>×</div>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}><GSEGameSettings appId={appId} /></div>
            <div style={{ padding: '15px', background: '#2a2e33', borderTop: '1px solid #3d4450', display: 'flex', justifyContent: 'flex-end' }}><DialogButton onClick={onClose}>Close</DialogButton></div>
        </div>
    </div>
);

const injectGameDetailsButton = async (doc: Document) => {
    const container = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (container && !container.querySelector('.gse-details-button')) {
        const appId = await getAppId(doc);
        if (!appId) return;

        log("Injecting button for AppID:", appId);
        const lastItem = container.lastElementChild as HTMLElement;
        let nextLeft = 0;
        if (lastItem) {
            nextLeft = parseInt(lastItem.style.left || '0') + (lastItem.offsetWidth || 100) + 8;
        }

        const btnContainer = doc.createElement('div');
        btnContainer.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
        btnContainer.style.cssText = `left: ${nextLeft}px; top: 0px; position: absolute;`;
        btnContainer.innerHTML = `<div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0"><div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span></div></div>`;
        btnContainer.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showGSEConfig(appId); });
        container.appendChild(btnContainer);
    }
};

const injectIntoGeneral = async (doc: Document) => {
    const allElements = doc.getElementsByTagName('*');
    let target: HTMLElement | null = null;
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i] as HTMLElement;
        if ((el.innerText === 'Launch Options' || el.innerText === 'LAUNCH OPTIONS' || el.innerText === 'Steam Cloud') && el.offsetWidth > 0) {
            target = el.closest('[class*="Section"]') || el.parentElement;
            break;
        }
    }
    if (!target) target = doc.querySelector('[class*="GeneralPage"]') || doc.querySelector('[class*="gameproperties_GeneralPage"]');

    if (target && !doc.querySelector('.gse-general-injected')) {
        const appId = await getAppId(doc);
        if (appId) {
            log("Injecting into General tab for AppID:", appId);
            const injectDiv = doc.createElement('div');
            injectDiv.className = 'gse-general-injected';
            injectDiv.style.cssText = 'margin: 20px 0; padding: 20px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);';
            if (target.parentElement && target.className.includes('Section')) target.parentElement.insertBefore(injectDiv, target);
            else target.prepend(injectDiv);

            const win = (doc.defaultView || window) as any;
            const ReactDOM = win.ReactDOM || (window as any).ReactDOM;
            if (ReactDOM) {
                if (ReactDOM.createRoot) ReactDOM.createRoot(injectDiv).render(<GSEGameSettings appId={appId} />);
                else ReactDOM.render(<GSEGameSettings appId={appId} />, injectDiv);
            }
        }
    }
};

export default definePlugin(() => {
    log("GSE Achievements plugin loading...");
    
    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        const doc = context.m_popup?.document;
        if (!doc) return;
        
        log("Window created:", context.m_strTitle || "Untitled");
        
        const observer = new MutationObserver(() => {
            if (doc.location.href.includes('/library/app/')) {
                injectGameDetailsButton(doc);
            }
            injectIntoGeneral(doc);
        });
        observer.observe(doc.body, { childList: true, subtree: true });
        
        // Initial try
        if (doc.location.href.includes('/library/app/')) injectGameDetailsButton(doc);
        injectIntoGeneral(doc);
    });

    setInterval(() => {
        injectGameDetailsButton(document);
        injectIntoGeneral(document);
    }, 2000);

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <div style={{padding: '20px'}}>GSE Achievements plugin is active. Check game properties or details to configure.</div>,
    };
});
