import {app, Menu, shell, dialog} from 'electron'

export interface MenuOptions {
    handleProject: () => Promise<void>
}

export function createApplicationMenu(opt: MenuOptions): void {
    const isMac = process.platform === 'darwin'

    const template: any[] = [
        // macOS app menu
        ...(isMac ? [{
            label: app.getName(),
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'services'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideothers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        }] : []),

        // File menu
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Project',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        await opt.handleProject()
                    }
                },
                {type: 'separator'},
                isMac ? {role: 'close'} : {role: 'quit'}
            ]
        },

        // Edit menu
        {
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                ...(isMac ? [
                    {role: 'pasteAndMatchStyle'},
                    {role: 'delete'},
                    {role: 'selectAll'},
                    {type: 'separator'},
                    {
                        label: 'Speech',
                        submenu: [
                            {role: 'startSpeaking'},
                            {role: 'stopSpeaking'}
                        ]
                    }
                ] : [
                    {role: 'delete'},
                    {type: 'separator'},
                    {role: 'selectAll'}
                ])
            ]
        },

        // View menu
        {
            label: 'View',
            submenu: [
                {role: 'reload'},
                {role: 'forceReload'},
                {role: 'toggleDevTools'},
                {type: 'separator'},
                {role: 'resetZoom'},
                {role: 'zoomIn'},
                {role: 'zoomOut'},
                {type: 'separator'},
                {role: 'togglefullscreen'}
            ]
        },

        // Window menu
        {
            label: 'Window',
            submenu: [
                {role: 'minimize'},
                {role: 'zoom'},
                ...(isMac ? [
                    {type: 'separator'},
                    {role: 'front'},
                    {type: 'separator'},
                    {role: 'window'}
                ] : [
                    {role: 'close'}
                ])
            ]
        },

        // Help menu
        {
            role: 'help',
            submenu: [
                {
                    label: 'About',
                    click: async () => {
                        await dialog.showMessageBox({
                            type: 'info',
                            title: 'About',
                            message: 'AI Editor',
                            detail: 'An intelligent code editor powered by AI'
                        })
                    }
                },
                {type: 'separator'},
                {
                    label: 'Learn More',
                    click: async () => {
                        await shell.openExternal('https://notbad.ai/')
                    }
                }
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}