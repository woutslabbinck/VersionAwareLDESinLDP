import Path from "path";
import {AppRunner} from "@solid/community-server";
import {readFileSync} from "fs";
import {Store} from "n3";
import {stringToStore} from "../../src/util/Conversion";
import {isLoggedin, login, RegistrationType, sleep} from "../../src/util/Login";

/***************************************
 * Title: solidHelper.ts
 * Description: Helper functions for setting up the test environment
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 28/03/2022
 *****************************************/
const {port, authport, email, password} = require('./testconfig.json')
export const baseUrl = `http://localhost:${port}/`
export const authBaseUrl = `http://localhost:${authport}/`
export const account = {
    email: email,
    password: password
}

export const webId = `${authBaseUrl}profile/card#me`

/**
 * Login to the auth solid-server
 */
export async function initAuth() {
    const validatedOptions = {
        applicationName: "LDES-orchestrator",
        registrationType: RegistrationType.Dynamic,
        solidIdentityProvider: authBaseUrl
    };
    try {
        const response = await fetch(authBaseUrl)
        if (response) {
            console.log("Login with email: test@mail.com password: test");
            await login(validatedOptions);
            await isLoggedin(); // code that checks whether you are already logged in
        }

    } catch (e) {
        console.log(`IDP not running at: ${authBaseUrl}. Tests requiring authentication will fail.`)
    }
}

/**
 * Start a solid server with public AC and file backend
 * @returns {Promise<void>}
 */
export async function runSolidPublic(): Promise<void> {
    await new AppRunner().run(
        {
            mainModulePath: `${__dirname}/`,
            logLevel: 'info',
            typeChecking: false,
        },
        Path.join(__dirname, 'memory-no-setup.json'),
        {
            'urn:solid-server:default:variable:loggingLevel': 'info',
            'urn:solid-server:default:variable:port': port,
            'urn:solid-server:default:variable:baseUrl': baseUrl,
        }
    );
}

export async function runSolidPrivate(): Promise<void> {
    await new AppRunner().run(
        {
            mainModulePath: `${__dirname}/`,
            logLevel: 'info',
            typeChecking: false,
        },
        Path.join(__dirname, 'memory-with-setup.json'),
        {
            'urn:solid-server:default:variable:loggingLevel': 'info',
            'urn:solid-server:default:variable:port': authport,
            'urn:solid-server:default:variable:baseUrl': authBaseUrl,
        }
    );
}

export async function registerAccount(): Promise<void> {
    const registrationBody = {
        registration: "on",
        createWebId: "on",
        webId: "",
        register: "on",
        createPod: "on",
        rootPod: "on",
        podName: "",
        email: account.email,
        password: account.password,
        confirmPassword: account.password
    }
    const response = await fetch(authBaseUrl + "setup", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'content-type': 'application/json'
        },
        body: JSON.stringify(registrationBody)
    })
    console.log("Create account now: ", await response.text())
    await sleep(1000) // needed for pod actually setting up
}

/**
 * Finishes if the CSS is already running
 * @returns {Promise<void>}
 */
export async function isRunning(): Promise<void> {
    let running = false
    while (!running) {
        try {
            const response = await fetch(baseUrl);
            if (response.status === 200) {
                running = true;
            }
        } catch (e) {
            // console.log('not running yet') // maybe add proper logging
        }
        await sleep(1000);
    }
}

/**
 * Convert a file as a store (given a path). Default will use text/turtle as content type
 * @param path
 * @param contentType
 * @returns {Promise<Store>}
 */
export async function fileAsStore(path: string, contentType?: string): Promise<Store> {
    contentType = contentType ? contentType : 'text/turtle';
    const text = readFileSync(Path.join(path), "utf8");
    return await stringToStore(text, {contentType});
}
