import { definePlugin, IconsModule } from '@steambrew/client';
import React from 'react';

const SettingsContent = () => {
    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h3>GSE Achievements Tracker</h3>
            <p>Plugin is active. Settings logic will be added once stability is confirmed.</p>
        </div>
    );
};

export default definePlugin(() => {
    console.log('GSE Achievements loading...');

    return {
        title: 'GSE Achievements',
        icon: <IconsModule.Settings />,
        content: <SettingsContent />,
    };
});
