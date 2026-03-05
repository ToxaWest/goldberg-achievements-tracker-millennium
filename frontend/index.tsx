import { Millennium, definePlugin, IconsModule } from '@steambrew/client';
import React from 'react';

const SettingsContent = () => {
    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h3>GSE Achievements</h3>
            <p>Plugin is active. Settings logic will be added once stability is confirmed.</p>
        </div>
    );
};

export default definePlugin(() => {
    console.log('GSE Achievements loading...');

    // Defensive hook registration matching working plugin pattern
    if (typeof Millennium !== 'undefined' && Millennium.AddWindowCreateHook) {
        Millennium.AddWindowCreateHook((context: any) => {
            // Only handle main Steam windows
            if (!context.m_strName?.startsWith('SP ')) return;
            console.log('GSE Achievements: Main window detected', context.m_strName);
        });
    }

    return {
        title: 'GSE Achievements',
        icon: <IconsModule.Settings />,
        content: <SettingsContent />,
    };
});
