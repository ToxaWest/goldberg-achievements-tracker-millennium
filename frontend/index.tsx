import { Millennium, definePlugin, IconsModule, callable } from '@steambrew/client';
import React from 'react';

const log = (...args: any[]) => console.log("[GSE]", ...args);

// Direct backend helpers
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

const AchievementItem = ({ a, config }: { a: any, config: any }) => {
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

    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ width: '32px', height: '32px', background: '#222', flexShrink: 0, borderRadius: '3px', overflow: 'hidden' }}>
                {iconData ? <img src={iconData} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: a.unlocked ? 1 : 0.2 }} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: a.unlocked ? '#fff' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.display_name}
                </div>
            </div>
            {a.unlocked && <div style={{ color: '#4caf50', fontSize: '12px' }}>✓</div>}
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
                const newCfg = { ...config, [field]: normalized, app_id: appId };
                await saveGameConfig(newCfg);
                loadData();
            }
        } catch (e) {}
    };

    if (isLoading) return <div style={{padding: '20px', color: '#888'}}>Syncing...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>GSE Settings (ID: {appId})</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>INTERFACE PATH</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input disabled style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={config?.interface_path || ''} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse('interface_path')}>📁</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>STATUS PATH</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input disabled style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={config?.status_path || ''} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse('status_path')}>📁</button>
                </div>
            </div>

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                        {achievements.map(a => <AchievementItem key={a.name} a={a} config={config} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

const showGSEConfig = (appId: string, doc: Document) => {
    const modalRoot = doc.createElement('div');
    doc.body.appendChild(modalRoot);
    const win = (doc.defaultView || window) as any;
    const rd = win.SP_REACTDOM || win.ReactDOM || (window as any).SP_REACTDOM;
    const onClose = () => {
        if (rd?.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        else if ((modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot.unmount();
        modalRoot.remove();
    };
    const element = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div style={{ width: '600px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right', borderTop: '1px solid #333' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
    if (rd?.createRoot) {
        if (!(modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot = rd.createRoot(modalRoot);
        (modalRoot as any)._gseRoot.render(element);
    } else if (rd?.render) {
        rd.render(element, modalRoot);
    }
};

const injectBPM = async (doc: Document, appId: string) => {
    const container = doc.querySelector('.vzLedtsu3TtTlKLEKzIhH');
    if (container && !container.querySelector('.gse-bpm-injected')) {
        const injectDiv = doc.createElement('div');
        injectDiv.className = 'gse-bpm-injected';
        container.prepend(injectDiv);
        
        const win = (doc.defaultView || window) as any;
        const rd = win.SP_REACTDOM || win.ReactDOM;
        if (rd) {
            const achievements = parseResult(await getAchievements({ app_id: appId }));
            const config = parseResult(await getGameConfig({ app_id: appId }));
            
            const element = (
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '15px' }}>GSE Achievements</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                        {achievements.map((a: any) => <AchievementItem key={a.name} a={a} config={config} />)}
                    </div>
                </div>
            );
            
            if (rd.createRoot) rd.createRoot(injectDiv).render(element);
            else rd.render(element, injectDiv);
        }
    }
};

let lastAppId: string | null = null;

const processInjection = async (doc: Document) => {
    const manager = (window as any).MainWindowBrowserManager || (doc.defaultView as any)?.MainWindowBrowserManager;
    let appId = manager?.m_lastLocation?.pathname?.match(/\/app\/(\d+)/)?.[1];
    if (!appId) appId = doc.location.href.match(/\/app\/(\d+)/)?.[1];
    
    if (!appId) return;
    if (appId !== lastAppId) {
        log("Game Page:", appId);
        lastAppId = appId;
    }

    // 1. Link Bar Injection (Desktop)
    const linksBar = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (linksBar) {
        let btn = linksBar.querySelector('.gse-details-button') as HTMLElement;
        const steamButtons = Array.from(linksBar.children).filter(c => c !== btn && (c as HTMLElement).style.left);
        const lastSteamBtn = steamButtons.sort((a,b) => parseInt((a as HTMLElement).style.left) - parseInt((b as HTMLElement).style.left)).pop() as HTMLElement;
        if (lastSteamBtn) {
            if (!btn) {
                btn = doc.createElement('div');
                btn.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
                btn.innerHTML = `<div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0"><div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span></div></div>`;
                linksBar.appendChild(btn);
            }
            btn.style.cssText = `left: ${parseInt(lastSteamBtn.style.left) + lastSteamBtn.offsetWidth + 8}px; top: 0px; position: absolute;`;
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); showGSEConfig(appId!, doc); };
        }
    }

    // 2. Big Picture Mode Injection
    injectBPM(doc, appId);
};

export default definePlugin(() => {
    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        if (!context.m_strName?.startsWith("SP ")) return;
        const doc = context.m_popup?.document;
        if (!doc?.body) return;
        const observer = new MutationObserver(() => processInjection(doc));
        observer.observe(doc.body, { childList: true, subtree: true });
        processInjection(doc);
    });
    return { title: "GSE Achievements", icon: <IconsModule.Settings />, content: <div style={{padding: '20px'}}>GSE active.</div> };
});
