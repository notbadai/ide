import {BaseExtensionOptions} from './system/base'
import {ExtensionData} from "../../ui/src/models/extension"
import {OnDemandExtension} from "./system/on_demand"

export class ApplyExtension extends OnDemandExtension {
    constructor(opt: BaseExtensionOptions) {
        super(opt)
    }

    protected getExtensionInfo(extensionData: ExtensionData): string {
        return this.config.getApplyExtension()
    }
}