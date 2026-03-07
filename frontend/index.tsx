import { Millennium, definePlugin, IconsModule, callable } from '@steambrew/client';
import React from 'react';

const log = (...args: any[]) => console.log("[GSE]", ...args);

// --- Backend Callables ---
const getGameConfig = callable<any, any>('get_game_config');
const getAchievements = callable<any, any>('get_achievements');
const saveGameConfig = callable<any, any>('save_game_config');
const getIconBase64 = callable<any, any>('get_icon_base64');

const parseResult = (res: any) => {
    if (typeof res === 'string') {
        try { return JSON.parse(res); } catch (e) { return res; }
    }
    return res;
};

// --- Components ---

const AchievementItem = ({ a, config, isBPM }: { a: any, config: any, isBPM: boolean }) => {
    const [iconData, setIconData] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (a.icon_path && config.interface_path) {
            const baseDir = config.interface_path.match(/(.*[/\\])/)?.[1] || "";
            getIconBase64({ path: baseDir + a.icon_path }).then((res: any) => {
                const data = typeof res === 'string' && res.startsWith('data:') ? res : parseResult(res);
                setIconData(data);
            }).catch(() => {});
        }
    }, [a.icon_path, config.interface_path]);

    const iconSize = isBPM ? '48px' : '32px';
    const fontSize = isBPM ? '14px' : '11px';

    return (
        <div style={{ 
            display: 'flex', gap: '8px', alignItems: 'center', 
            padding: isBPM ? '10px' : '6px', 
            background: 'rgba(0,0,0,0.2)', borderRadius: '4px' 
        }}>
            <div style={{ width: iconSize, height: iconSize, background: '#222', flexShrink: 0, borderRadius: '3px', overflow: 'hidden' }}>
                {iconData ? <img src={iconData} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: a.unlocked ? 1 : 0.2 }} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fontSize, fontWeight: 'bold', color: a.unlocked ? '#fff' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.display_name}
                </div>
                {isBPM && a.description && (
                    <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {a.description}
                    </div>
                )}
            </div>
            {a.unlocked && <div style={{ color: '#4caf50', fontSize: isBPM ? '14px' : '10px' }}>✓</div>}
        </div>
    );
};

const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [config, setConfig] = React.useState<any>(null);
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadData = async () => {
        const cfg = parseResult(await getGameConfig({ app_id: appId }));
        setConfig(cfg);
        const data = parseResult(await getAchievements({ app_id: appId }));
        setAchievements(Array.isArray(data) ? data : []);
        setIsLoading(false);
    };

    React.useEffect(() => { loadData(); }, [appId]);

    const handleBrowse = async (field: string) => {
        const sc = (window as any).SteamClient || (window as any).opener?.SteamClient;
        const picker = sc?.Window?.OpenFilePicker || sc?.Browser?.OpenFilePicker || sc?.OpenFilePicker;
        if (typeof picker !== 'function') return alert("Picker not found.");
        try {
            const path = await picker("Select achievements.json", "", false);
            if (path) {
                const normalized = path.replace(/\\/g, '/').replace(/"/g, '').trim();
                await saveGameConfig({ ...config, [field]: normalized, app_id: appId });
                loadData();
            }
        } catch (e) {}
    };

    if (isLoading) return <div style={{padding: '20px', color: '#888'}}>Syncing...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>GSE Settings (ID: {appId})</h2>
            {['interface_path', 'status_path'].map(field => (
                <div key={field} style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>{field.toUpperCase()}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input disabled style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={config?.[field] || ''} />
                        <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse(field)}>📁</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const AchievementsView = ({ appId, isBPM, doc }: { appId: string, isBPM: boolean, doc: Document }) => {
    const [config, setConfig] = React.useState<any>(null);
    const [achievements, setAchievements] = React.useState<any[]>([]);

    const load = async () => {
        const cfg = parseResult(await getGameConfig({ app_id: appId }));
        log(`View: Config for ID ${appId} >`, cfg);
        setConfig(cfg);
        const data = parseResult(await getAchievements({ app_id: appId }));
        setAchievements(Array.isArray(data) ? data : []);
    };

    React.useEffect(() => { load(); }, [appId]);

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div style={{ 
            padding: isBPM ? '20px' : '15px', 
            background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '20px',
            border: isBPM ? 'none' : '1px solid rgba(255,255,255,0.05)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: isBPM ? '24px' : '16px', margin: 0, color: '#eee' }}>GSE Achievements</h2>
                    {!isBPM && (
                        <button 
                            onClick={() => showGSEConfig(appId, doc)}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#888', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}
                        >Settings</button>
                    )}
                </div>
                <span style={{ fontSize: isBPM ? '16px' : '12px', color: '#888' }}>
                    Earned {unlockedCount} of {achievements.length}
                </span>
            </div>

            {(!config || !config.interface_path) ? (
                <div style={{ color: '#666', fontSize: '12px' }}>Please configure paths in settings. (ID: {appId})</div>
            ) : (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: isBPM ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))', 
                    gap: isBPM ? '15px' : '8px' 
                }}>
                    {achievements.map(a => <AchievementItem key={a.name} a={a} config={config} isBPM={isBPM} />)}
                </div>
            )}
        </div>
    );
};

// --- UI Helpers ---

const showGSEConfig = (appId: string, doc: Document) => {
    const win = (doc.defaultView || window) as any;
    const rd = win.SP_REACTDOM || win.ReactDOM || win.opener?.SP_REACTDOM || win.opener?.ReactDOM;
    if (!rd) return;

    const modalRoot = doc.createElement('div');
    doc.body.appendChild(modalRoot);
    const onClose = () => {
        if (rd?.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        else if ((modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot.unmount();
        modalRoot.remove();
    };

    const element = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div style={{ width: '500px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right', borderTop: '1px solid #333' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );

    if (rd?.createRoot) {
        const root = (modalRoot as any)._gseRoot || rd.createRoot(modalRoot);
        (modalRoot as any)._gseRoot = root;
        root.render(element);
    } else rd.render(element, modalRoot);
};

const getAppId = (doc: Document) => {
    const win = (doc.defaultView || window) as any;
    
    // 1. Path check (Reliable for BPM Popups)
    let id = doc.location.pathname?.match(/\/app\/(\d+)/)?.[1] || doc.location.href?.match(/\/app\/(\d+)/)?.[1];
    if (id) { log("ID from URL:", id); return id; }

    // 2. Manager check (Reliable for Desktop Library)
    // We prioritize window.top as it tracks the main library route in Desktop
    const manager = (window.top as any)?.MainWindowBrowserManager || win.MainWindowBrowserManager;
    id = manager?.m_lastLocation?.pathname?.match(/\/app\/(\d+)/)?.[1];
    if (id) { log("ID from Manager:", id); return id; }

    // 3. Hero Image (Reliable fallback for any game page)
    const hero = doc.querySelector('img[class*="libraryhero_LibraryHeroImg"], img[src*="library_hero"], img[src*="/assets/"]') as HTMLImageElement;
    if (hero) {
        const src = hero.src || hero.getAttribute('src') || "";
        const match = src.match(/\/assets\/(\d+)/) || src.match(/\/app\/(\d+)/);
        if (match) { log("ID from Hero Image:", match[1]); return match[1]; }
    }
    
    return null;
};

// --- Core Logic ---

const injectedIds = new WeakMap<Document, string>();

const processInjection = async (doc: Document) => {
    const isDesktop = doc.body.classList.contains("DesktopUI") || doc.documentElement.classList.contains("DesktopUI");
    const isBPM = !isDesktop;

    const appId = getAppId(doc);
    
    if (!appId) {
        const existing = doc.querySelector('.gse-injected-view');
        if (existing) { existing.remove(); injectedIds.delete(doc); }
        return;
    }

    // BPM Tab Validation
    if (isBPM) {
        const whatsNew = doc.getElementById('«rs7»WhatsNew_Content') || 
                         doc.getElementById('«rod»WhatsNew_Content') ||
                         doc.querySelector('[id*="WhatsNew_Content"]');

        if (!whatsNew) {
            const existing = doc.querySelector('.gse-injected-view');
            if (existing) { existing.remove(); injectedIds.delete(doc); }
            return;
        }
    }

    // Handle game switch per document
    if (appId !== injectedIds.get(doc)) {
        log(`Injecting for ${appId} (Mode: ${isBPM ? 'BPM' : 'Desktop'})`);
        const existing = doc.querySelector('.gse-injected-view');
        if (existing) existing.remove();
        injectedIds.set(doc, appId);
    }

    const container = doc.querySelector('.vzLedtsu3TtTlKLEKzIhH') || 
                      doc.querySelector('[class*="gamepaddetails_ControlsContainer"]');

    if (container && !container.querySelector('.gse-injected-view')) {
        const win = (doc.defaultView || window) as any;
        const rd = win.SP_REACTDOM || win.ReactDOM || win.opener?.SP_REACTDOM || win.opener?.ReactDOM;
        if (!rd) return;

        const injectDiv = doc.createElement('div');
        injectDiv.className = 'gse-injected-view';
        injectDiv.style.width = '100%';
        container.prepend(injectDiv);

        const element = <AchievementsView appId={appId} isBPM={isBPM} doc={doc} />;
        
        if (rd.createRoot) {
            const root = (injectDiv as any)._gseRoot || rd.createRoot(injectDiv);
            (injectDiv as any)._gseRoot = root;
            root.render(element);
        } else rd.render(element, injectDiv);
    }
};

export default definePlugin(() => {
    const observe = (doc: Document) => {
        const observer = new MutationObserver(() => processInjection(doc));
        observer.observe(doc.documentElement || doc.body, { childList: true, subtree: true });
        processInjection(doc);
    };

    observe(document);
    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        const doc = context.m_popup?.document;
        if (doc) observe(doc);
    });

    return { title: "GSE Achievements", icon: <IconsModule.Settings />, content: <div style={{padding: '20px'}}>GSE active.</div> };
});
