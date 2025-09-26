import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {Dropdown} from '../../components/dropdown'
import {clearChildElements} from "../../utils/document"
import {Project} from "../../models/project"
import {FileOrFolderNode} from "./file_or_folder_node"
import {File} from "../../models/file"

export interface FileExplorerOptions {
    onFileChangeClick: (file: File) => void
}

export class FileExplorer {
    private elem: HTMLElement
    private fileListElem: HTMLDivElement

    private readonly utilsDropdown: Dropdown

    private currSelectedNode: FileOrFolderNode
    private mainNode: FileOrFolderNode  // add reference to main node

    private readonly onFileChangeClick: (file: File) => void

    constructor(opt: FileExplorerOptions) {
        this.onFileChangeClick = opt.onFileChangeClick

        this.utilsDropdown = new Dropdown({
            options: [
                {text: 'New File', onClick: null, icon: '.fas.fa-file-alt'},
                {text: 'New Directory', onClick: null, icon: '.fas.fa-folder'},
                {text: 'Rename', onClick: null, icon: '.fas.fa-pen'},
                {text: 'Delete', onClick: null, icon: '.fas.fa-trash-alt', color: '#ff5252'},
            ]
        })
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.file-explorer', $ => {
            this.utilsDropdown.render($)
            this.fileListElem = $('div', '.file-list')
        })

        document.addEventListener("click", () => this.utilsDropdown.display(false))
    }

    public renderFiles(project: Project) {
        project.files.sort((a, b) => (a.path < b.path ? -1 : 1))

        clearChildElements(this.fileListElem)
        $(this.fileListElem, $ => {
            this.mainNode = this.getFolderStructure(project)  // Store reference
            this.mainNode.render($)
            this.mainNode.unCollapse()
        })
    }

    private getFolderStructure(project: Project) {
        let mainNode = null
        for (let file of project.files) {
            let parent = null
            let split = file.path.split('/')
            for (let i = 1; i < split.length + 1; i++) {
                let title = split[i - 1]

                let isFile = i == split.length && !file.is_empty_dir

                if (mainNode == null) {
                    mainNode = new FileOrFolderNode({
                        title: title,
                        file: isFile ? file : null,
                        onFileChange: this.onFileChange.bind(this),
                        utilsDropDown: this.utilsDropdown,
                        parent: null,
                        isEditable: false,
                    })
                    parent = mainNode
                } else if (parent != null) {
                    parent = parent.addChildNode({
                        title: title,
                        file: isFile ? file : null,
                        onFileChange: this.onFileChange.bind(this),
                        utilsDropDown: this.utilsDropdown,
                        parent: parent,
                        isEditable: false,
                    })
                } else {
                    parent = mainNode
                }
            }
        }

        return mainNode
    }

    private onFileChange(node: FileOrFolderNode) {
        this.onFileChangeClick(node.file)

        if (this.currSelectedNode != null) {
            this.currSelectedNode.selected(false)
        }
        this.currSelectedNode = node
        this.currSelectedNode.selected(true)
    }

    public getFileAndFolderList(): Array<{ path: string, isFile: boolean }> {
        if (!this.mainNode) {
            return []
        }

        return this.mainNode.getFileAndFolderList()
    }
}