
import { createElement } from "../utils/dom";
import { setImportantStyles } from "../utils/style";
import { feUrl } from "./services";
import { addQueryParams } from "../utils/url";
import { Doc } from "../model/doc";

enum GisInteropManagerStates {
    UNINITIALIZED,
    LISTENING,
    LOADING_COMMUNICATION_IFRAME,
};

export class GisInteropManager {
    private state = GisInteropManagerStates.UNINITIALIZED;
    private readonly messageHanlderValue: (ev: MessageEvent<any>) => void;
    private sessionId?: string;
    private source: MessageEventSource | null = null;
    private sourceOrigin?: string;
    private iframe?: HTMLElement;

    constructor(private readonly doc: Doc) {
        this.messageHanlderValue = this.messageHanlder.bind(this);
        this.state = GisInteropManagerStates.LISTENING;
        this.doc.getWin().addEventListener('message', this.messageHanlderValue);
    }
    private messageHanlder(ev: MessageEvent<any>) {
        if (this.shouldHandlePing(ev)) {
            this.handlePing(ev);
        }
    }

    private shouldHandlePing(ev: MessageEvent<any>): boolean {
        return ev.data.type === 'RRM_GIS_PING' &&
            this.state === GisInteropManagerStates.LISTENING &&
            !this.sessionId &&
            typeof ev.data.sessionId === 'string' &&
            !this.source;
    }

    private handlePing(ev: MessageEvent<{ sessionId: string }>) {
        console.log(ev);
        this.state = GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME;
        this.sessionId = ev.data.sessionId;
        this.source = ev.source;
        this.sourceOrigin = ev.origin;
        this.source?.postMessage({
            type: 'RRM_GIS_ACK',
            sessionId: this.sessionId
        });

        const src = addQueryParams(feUrl('/rrmgisinterop'), {
            'sessionId': this.sessionId!,
            'rrmOrigin': this.doc.getWin().origin,
            'gisOrigin': this.sourceOrigin,
        })

        this.iframe = createElement(this.doc.getRootNode(), 'iframe', {
            'src': src,
            'tabindex': '-1',
            'aria-hidden': 'true',
        });

        setImportantStyles(this.iframe, {
            'width': '0',
            'height': '0',
            'border': 'none',
            'position': 'absolute',
            'visibility': 'hidden',
        });

        this.doc.getBody()?.appendChild(this.iframe);
    }
}