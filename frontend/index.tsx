import { definePlugin, IconsModule } from '@steambrew/client';

const SettingsContent = () => {
    // @ts-ignore
    return window.SP_REACT.createElement('div', { style: { padding: '20px', color: 'white' } }, 
        window.SP_REACT.createElement('h3', null, 'GSE Achievements'),
        window.SP_REACT.createElement('p', null, 'Plugin is active.')
    );
};

export default definePlugin(() => {
    console.log('GSE Achievements loading...');

    return {
        title: 'GSE Achievements',
        icon: IconsModule.Settings, // Some versions expect the component, some the reference
        content: SettingsContent,
    };
});
