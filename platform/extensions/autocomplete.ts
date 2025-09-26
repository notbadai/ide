import {BaseExtensionOptions} from './system/base'
import {ExtensionData} from "../../ui/src/models/extension"
import {PersistentExtension} from "./system/persistent"


export class AutocompleteExtension extends PersistentExtension {
    constructor(opt: BaseExtensionOptions) {
        super(opt)
    }

    protected getExtensionInfo(extensionData: ExtensionData): string {
        const extensionConfig = this.config
        return extensionConfig.getAutocompleteExtension()
    }
}