"use server";

import { SessionData, sessionOptions } from "./lib/session";
import { IronSession, getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import createReportApiWrapper from "./lib/esgReport";
import { promisify } from "util";

export const get = async () => { };

export const getSession = async () => {
  let session = await getIronSession<SessionData>(cookies(), sessionOptions);

  const now = new Date().getTime();
  if (Object.keys(session).length > 0 && now > session.expire) {
    session = {} as IronSession<SessionData>;
  }

  return session;
};

export const login = async (
  username: string,
  password: string
): Promise<void | {error: string}> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/auth/local`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      return {error: "Invalid credentials"};
    }
    return {error: "Something went wrong"};
  }
  const responseBody = await response.json();

  const session = await getIronSession<SessionData>(
    cookies(),
    sessionOptions,
  );

  const { token } = responseBody;
  const nodes = await getNodes(token);
  const role = await getRole(token);

  Object.assign(session, {
    userID: (await getUser(token))._id,
    role: role ? role : "tenant",
    accessToken: token,
    nodes: nodes.map((node: any) => ({
      name: node.name,
      id: node._id,
    })),
    expire: new Date().getTime() + 1000 * 60 * 60 * 5,
  })

  await session.save();
  revalidatePath("/");
};

export const logout = async () => {
  const session = await getSession();
  session!.destroy();
  redirect("/");
};

export const getNodes = async (token: string) => {
  let response;
  let nodes;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/iotnodes`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    nodes = await response.json();
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return nodes;
};

export const getNode = async (token: string, nodeID: string) => {
  let response;
  let node;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/iotnodes/${nodeID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    node = await response.json();
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return node;
};

export const getUser = async (token: string) => {
  let response;
  let user;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/users/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token!}`,
          "Content-Type": "application/json",
        },
      },
    );

    user = await response.json();
  } catch (error: any) {
    console.log(error);
    return undefined;
  }

  return user;
};

export const getRole = async (token: string) => {
  let response;
  let role;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/usergroups`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const groups = await response.json();
    role = groups[0].name;
  } catch (error: any) {
    return undefined;
  }

  return role;
};

export const getChannels = async (token: string, nodeID: string) => {
  let response;
  let channels;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/channels?iotnode=${nodeID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    channels = await response.json();
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return channels;
};

export const createBasicCredentialsSet = async (id: string, token: string) => {
  let response;
  let credentials;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/basic-credentials-sets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: process.env.NEXT_PUBLIC_YGGIO_MQTT_USERNAME,
          password: process.env.NEXT_PUBLIC_YGGIO_MQTT_PASSWORD,
        }),
      },
    );
    // console.log(response);

    if (response.status === 404) {
      return undefined;
    }

    credentials = await response.json();

    console.log("Credentials:", credentials);
  } catch (error: any) {
    console.log("Error:", error.message);

    return undefined;
  }

  return credentials;
};

export const getBasicCredentialSet = async (id: string, token: string) => {
  const currentSets = await getBasicCredentialsSets(token);
  let set;

  if (currentSets.length === 0 || currentSets === undefined) {
    set = await createBasicCredentialsSet(id, token);
  }

  return set ? set : currentSets[0];
};

export const getBasicCredentialsSets = async (token: string) => {
  let response;
  let credentials;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/basic-credentials-sets`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 404) return undefined;

    credentials = await response.json();
  } catch (error: any) {
    console.log(error.message);
    return undefined;
  }

  return credentials;
};
export const createChannel = async (token: string, nodeID: string) => {
  let response;
  let channel;

  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "iot-esg-app-channel",
          iotnode: nodeID,
          mqtt: {
            type: "basicCredentialsSet",
            recipient: process.env.NEXT_PUBLIC_SET_ID,
          },
        }),
      },
    );

    if (response.ok) {
      channel = await response.json();
      console.log("Channel created:", channel);
    } else {
      console.log("Failed to create channel:", response.statusText);
      return undefined;
    }
  } catch (e) {
    console.log("Error creating channel:", e);
    return undefined;
  }

  return channel;
};

/*
 * Retrieves the stat for a node.
 *
 * token, nodeID, measurement = Required.
 * start, end, distance = Optional.
 *
 * @param {string} token - The accesstoken required to access the API.
 * @param {string} nodeID - The ID of the node for which to retrieve stats.
 * @param {string} measurement - The name of the measurement to retrieve stats for.
 * @param {number} start - The start of the time period, in unix milliseconds time (i.e., milliseconds since 1970-01-01 00:00:00).
 * @param {number} end - The end of the time period, in unix milliseconds time (i.e., milliseconds since 1970-01-01 00:00:00).
 * @param {number} distance - The number of seconds between data points.
 */
export const getNodeStats = async (
  token: string,
  nodeID: string,
  measurement: string,
  start?: number,
  end?: number,
  distance?: number,
): Promise<NonNullable<any> | undefined> => {
  let url = `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/iotnodes/${nodeID}/stats?measurement=${measurement}`;

  if (start !== undefined) {
    url += `&start=${start}`;
  }

  if (end !== undefined) {
    url += `&end=${end}`;
  }

  if (distance !== undefined) {
    url += `&distance=${distance}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.ok) {
    return await response.json();
  } else {
    return undefined;
  }
};

export const getList = () => {
  const list = {
    co2: "6234b61cd68c97000897fca9",
    temperatureID: "60a3ab8b007e8f00076009eb",
  };

  return list;
};

export const get2 = async () => { };

export const storeCurrentTemperature = async (
  token: string,
  nodeID: string,
  contextMap: any,
  newTemp: number,
) => {
  revalidateTag(nodeCacheTagByContext("thermostat"));

  if (Object.hasOwn(contextMap, 'termotemp')) {
    contextMap['termotemp'] = newTemp;
  }

  console.log("contextMap:", contextMap)

  let url = `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/iotnodes/${nodeID}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      contextMap: contextMap
    }),

  });

  if (response.ok) {
    return await response.json();
  } else {
    return undefined;
  }
};

export const changeTempOnTerm = async (
  token: string,
  url: string,
) => {

  const fullUrl = process.env.NEXT_PUBLIC_YGGIO_API_URL + url
  console.log("Temperature URL:", fullUrl)

  const response = await fetch(fullUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
  });

  if (response.ok) {
    return response.ok;
  } else {
    return undefined;
  }
};

function nodeCacheTagByContext(context: string): string {
  return `node-by-context-${context}`;
}

export const getNodeByContext = async (
  token: string,
  context: string,
): Promise<any | null> => {
  let pattern = JSON.stringify({[`contextMap.LNU_type_${context}`]: context });
  let url = `${process.env.NEXT_PUBLIC_YGGIO_API_URL}/iotnodes?matchPattern=` + pattern;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    next: { tags: [nodeCacheTagByContext(context)] },
  });

  if (response.ok) {
    const nodes = await response.json();
    return nodes.length ? nodes[0] : undefined;
  } else {
    return undefined;
  }
};

export const checkReport = async (
  token: string,
) => {

  // const response = await fetch(`${process.env.NEXT_PUBLIC_YGGIO_API_URL}/reports/report-bases`, {
  //   method: "GET",
  //   headers: {
  //     Authorization: `Bearer ${token}`,
  //     "Content-Type": "application/json",
  //   },
  // });

  // Must be imported dynamically because Next.js the actions module is
  // imported by the middleware (among other things) which Next.js wants
  // to run on the edge runtime, which doesn't support this API.
  const execFile = promisify((await import("child_process")).execFile);

  const { stdout, stderr } = await execFile("python3", ["--version"]);
  console.log("stdout:", stdout);
  console.error("stderr:", stderr);

  let api = createReportApiWrapper(token)
  console.log("report bases", await api.getReportBases())

  const reportBaseName = "esg-report-template"

  // let localTemplateFilename = "esg-report-template.xlsx"
  // let fileData = await fs.readFile(localTemplateFilename)
  // let uploaded = await api.uploadReportTemplate("esg-report.xlsx", fileData)
  // console.log(uploaded)
  // let filename = uploaded.filename;
  let filename = "Standard-Connectivity";

  const newWonderfulReportBaseSpec = {
    "name": reportBaseName,
    "description": "Trying some stuff!", // Beskrivning
    "fileName": filename, // Detta är namnet på filen som är bifogad i detta slack meddelande
    "secondsBetweenPoints": 0, // Hur många sekunder mellan varje tidsserie punkt från varje iotnod, (I detta fall 0 sekunder som betyder _alla_ tidsseriepunkter för varje vald nod)
    "sources": [  // Sources, en lista av olika filtreringar för hur och vad du vill hämta från våra databaser
      {
        "valueFunction": "mean", // en funktion riktad till våran tidsserie databas, `mean` värde för varje tidsseriepunkt i databasen
        "query": "electricityConsumption", // ett query på vilka noder du vill hämta från ditt konto (i detta fallet hämtar vi alla noder som har fältet `rssi`.) (Det är detta queryt som fyller upp `iotnodeRawData` arket)
        "fields": [ // Fields, en lista på fältnamn som du vill hämta från tiddserien. Här bestäms alltså vilka tidsseriefält du vill hämta, medans `query` hämtar alla fält, men bara det senaste värdena
          {
            "name": "electricityConsumption", // namnet på fältet du vill hämta ( i detta fall rssi )
            "prettyName": "electricity Consumption", // Prettyname är till för hur det ska se ut i vårat UI eller excel arken ( här kan stå vad som helst )
            "dataType": "float" // dataType, vilken datatyp är det på fältet, just nu har vi bara stöd för "float"
          },
          { // Samma gäller för snr, vill man lägga till fler går det bra också.
            "name": "snr",
            "prettyName": "SNR",
            "dataType": "float"
          }
        ]
      }
    ]
  }

  // Delete existing report bases.
  let reportBaseIds = (await api.getReportBases())
    .filter((r: any) => r.name === reportBaseName)
    .map((r: any) => r._id)
  console.log("Existing report bases:", reportBaseIds)
  let id
  while (id = reportBaseIds.pop()) {
    console.log(`Deleting report base: ${id}`)
    console.log(await api.deleteReportBase(id))
  }

  let reportBase = await api.createReportBase(newWonderfulReportBaseSpec)
  console.log("report base", reportBase)
 console.log("report ID: ", reportBase._id)
  let generatedReport = await api.generateReport(reportBase._id)
  //console.log(generatedReport.downloadUrl)

  return generatedReport.downloadUrl
}
