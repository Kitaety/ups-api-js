import { API as BaseAPI, mix, load, conf, verify } from "yonius";
import { DocumentAPI } from "./document";
import { LocatorAPI } from "./locator";
import { ShipmentAPI } from "./shipment";
import { TrackingAPI } from "./tracking";

const DOCUMENT_BASE_URL = "https://filexfer.ups.com/rest/PaperlessDocumentAPI/";
const LOCATOR_BASE_URL = "https://onlinetools.ups.com/ups.app/xml/Locator";
const SHIPPING_BASE_URL = "https://onlinetools.ups.com/ship/v1807/";
const TRACKING_BASE_URL = "https://onlinetools.ups.com/track/v1/";

export class API extends mix(BaseAPI).with(DocumentAPI, LocatorAPI, ShipmentAPI, TrackingAPI) {
    constructor(kwargs = {}) {
        super(kwargs);
        this.documentBaseUrl = conf("UPS_DOCUMENT_BASE_URL", DOCUMENT_BASE_URL);
        this.locatorBaseUrl = conf("LOCATOR_BASE_URL", LOCATOR_BASE_URL);
        this.shippingBaseUrl = conf("UPS_SHIPPING_BASE_URL", SHIPPING_BASE_URL);
        this.trackingBaseUrl = conf("UPS_TRACKING_BASE_URL", TRACKING_BASE_URL);
        this.license = conf("UPS_LICENSE", null);
        this.username = conf("UPS_USERNAME", null);
        this.password = conf("UPS_PASSWORD", null);
        this.transactionSrc = conf("UPS_TRANSACTION_SRC", null);
        this.shippingBaseUrl =
            kwargs.shippingBaseUrl === undefined ? this.shippingBaseUrl : kwargs.shippingBaseUrl;
        this.documentBaseUrl =
            kwargs.documentBaseUrl === undefined ? this.documentBaseUrl : kwargs.documentBaseUrl;
        this.trackingBaseUrl =
            kwargs.trackingBaseUrl === undefined ? this.trackingBaseUrl : kwargs.trackingBaseUrl;
        this.license = kwargs.license === undefined ? this.license : kwargs.license;
        this.username = kwargs.username === undefined ? this.username : kwargs.username;
        this.password = kwargs.password === undefined ? this.password : kwargs.password;
        this.transactionSrc =
            kwargs.transactionSrc === undefined ? this.transactionSrc : kwargs.transactionSrc;
    }

    static async load() {
        await load();
    }

    async build(method, url, options = {}) {
        await super.build(method, url, options);
        options.kwargs = options.kwargs !== undefined ? options.kwargs : {};
        const auth = options.kwargs.auth;
        delete options.kwargs.auth;

        // determines the kind of authentication method to be used and
        // changes the corresponding header or data payload
        switch (auth) {
            case "headers":
                options.headers = options.params !== undefined ? options.headers : {};
                options.headers.AccessLicenseNumber = this.license;
                if (this.username) options.headers.Username = this.username;
                if (this.password) options.headers.Password = this.password;
                break;
            case "dataJ":
                options.dataJ = options.dataJ !== undefined ? options.dataJ : {};
                options.dataJ.UPSSecurity = options.dataJ.UPSSecurity || {
                    UsernameToken: {
                        Username: this.username,
                        Password: this.password
                    },
                    ServiceAccessToken: {
                        AccessLicenseNumber: this.license
                    }
                };
                break;
        }

        const transactionSrc = options.headers.transactionSrc || this.transactionSrc;
        if (transactionSrc) options.headers.transactionSrc = transactionSrc;
    }

    async _handleResponse(response, errorMessage = "Problem in request") {
        const result = await this._getResult(response);
        const errors =
            result.response && result.response.errors
                ? result.response.errors.map(error => JSON.stringify(error)).join(",")
                : null;
        verify(!errors, errors, response.status || 500);
        verify(!result.Fault, result.error || errorMessage, response.status || 500);
        verify(response.ok, result.error || errorMessage, response.status || 500);
        return result;
    }

    /**
     * Obtains the response object from the provided response making sure that the
     * content type is respected when doing so.
     *
     * @param {Response} response The HTTP response resulting from the request
     * made by the API client
     * @returns {Object|String|Blob} The parsed result value for the provided
     * response object taking into account the content type of it.
     */
    async _getResult(response) {
        let result = null;
        if (
            response.headers.get("content-type") &&
            response.headers.get("content-type").toLowerCase().startsWith("application/json")
        ) {
            result = await response.json();
        } else if (
            response.headers.get("content-type") &&
            response.headers.get("content-type").toLowerCase().startsWith("text/")
        ) {
            result = await response.text();
        } else {
            result = await response.blob();
        }
        return result;
    }

    /**
     * Retrieves the document base URL, normalizing it according to
     * the limitation of the UPS API.
     *
     * @returns {String} The normalized document base URL normalized and
     * ready to be used by API calls.
     */
    _getDocumentBaseUrl() {
        // removes the trailing slash, as the API doesn't handle it properly
        return this.documentBaseUrl.slice(0, this.documentBaseUrl.length - 1);
    }

    _getXMLHeader() {
        return `<?xml version="1.0"?> 
        <AccessRequest xml:lang="en-US"> 
            <AccessLicenseNumber>${this.license}</AccessLicenseNumber> 
            <UserId>${this.username}</UserId> 
            <Password>${this.password}</Password> 
        </AccessRequest>`;
    }
}
