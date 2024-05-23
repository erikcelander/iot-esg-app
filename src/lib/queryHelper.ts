import { getNode, getNodeStats, getNodes, storeCurrentTemperature, getNodeByContext } from "@/actions";
import { WaterChartParams } from "@/components/home/tenant/water-chart";

export const fetchChartData = async (
  accessToken: string,
  range: string,
  chart: string,
  chartParams: unknown
) => {
  const currentTimestamp = Date.now();
  let startTime;
  let distance;
  let axisBottomFormat;
  let axisBottomTickValues;

  switch (range) {
    case "24h":
      startTime = currentTimestamp - 24 * 60 * 60 * 1000; // Last 24 hours
      distance = 3600; // 1 hour in seconds
      axisBottomFormat = "HH:mm";
      axisBottomTickValues = { unit: "hour", stepSize: 1 };
      break;
    case "7d":
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to 00:00 local time so get data from start of the day and not 24 hours from now
      const startOfSevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // Set to 00:00 of 7 days ago
      startTime = startOfSevenDaysAgo.getTime();
      distance = 3600; // 1 hour in seconds
      axisBottomFormat = "EEE";
      axisBottomTickValues = { unit: "day", stepSize: 1 };
      break;
    case "30d":
      startTime = currentTimestamp - 30 * 24 * 60 * 60 * 1000; // Last 30 days
      distance = 86400; // 1 day in seconds
      axisBottomFormat = "MMM d";
      axisBottomTickValues = { unit: "day", stepSize: 1 };
      break;
    default:
      startTime = currentTimestamp - 7 * 24 * 60 * 60 * 1000; // Default to last 7 days
      distance = 3600; // 1 hour in seconds
      axisBottomFormat = "MMM d";
      axisBottomTickValues = { unit: "day", stepSize: 1 };
  }

  const xAxisOptions = {
    type: "time",
    time: {
      unit: axisBottomTickValues.unit,
      displayFormats: {
        [axisBottomTickValues.unit]: axisBottomFormat,
      },
      stepSize: axisBottomTickValues.stepSize,
    },
  };

  switch (chart) {
    case "electricityChart":
      return fetchElectricityData(
        accessToken,
        chartParams as string,
        startTime,
        currentTimestamp,
        distance,
        xAxisOptions,
      );
    case "temperatureChart":
      return fetchTemperatureData(
        accessToken,
        chartParams as string,
        startTime,
        xAxisOptions
      );

    case "co2Chart":
      return fetchCo2Data(
        accessToken,
        chartParams as string,
        startTime,
        currentTimestamp,
        distance,
        xAxisOptions,
      );

    case "electricityConsumptionChart":
      return fetchElectricityConsumption(
        accessToken,
        chartParams as string,
        startTime,
        currentTimestamp,
        distance,
        xAxisOptions,
      );

    case "waterChart":
      return fetchWaterData(
        accessToken,
        chartParams as WaterChartParams,
        startTime,
        currentTimestamp,
        range === "7d" ? 86400 : distance,
        xAxisOptions,
      );
  }
};

export const fetchCo2Data = async (
  accessToken: string,
  nodeID: string,
  startTime: number,
  currentTimestamp: number,
  distance: number,
  xAxisOptions: any,
) => {
  console.log("CO2 data fetch start time:", startTime);
  const co2Data = await getNodeStats(
    accessToken,
    nodeID,
    "co2",
    startTime,
    currentTimestamp,
    distance,
  );

  const formattedData = formatData(co2Data);

  const labels = formattedData.map((item: any) => item.x.toISOString());
  const values = formattedData.map((item: any) => item.y.toFixed(0));

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Co2",
        data: values,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        yAxisID: "y",
      },
    ],
  };

  return { data, xAxisOptions };
};

export const fetchTemperatureData = async (
  accessToken: string,
  nodeID: string,
  startTime: number,
  xAxisOptions: any,
) => {
  // console.log(startTime);
  const temperatureData = await getNodeStats(
    accessToken,
    nodeID,
    "temperature",
    startTime,
  );
  // console.log(temperatureData);

  const start = new Date(startTime);

  const filteredData = temperatureData.filter((data: any) => {
    const time = new Date(data.time);

    return time >= start;
  });

  const formattedData = formatData(filteredData);
  const labels = formattedData.map((item: any) => item.x.toISOString());
  const values = formattedData.map((item: any) => item.y);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Temperature",
        data: values,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        yAxisID: "y",
      },
    ],
  };

  return { data, xAxisOptions };
};

export const fetchElectricityData = async (
  accessToken: string,
  nodeID: string,
  startTime: number,
  currentTimestamp: number,
  distance: number,
  xAxisOptions: any,
) => {
  const incrementalConsumptionData = await fetchConsumptioneData({
    accessToken,
    nodeID,
    startTime,
    currentTimestamp,
    distance,
  });

  const electricityPriceData = await fetchElectricityPriceData({
    accessToken,
    startTime,
    currentTimestamp,
    distance,
  });

  const labels = incrementalConsumptionData.map((item: any) =>
    item.x.toISOString(),
  );
  const consumptionData = incrementalConsumptionData.map((item: any) => item.y);
  const priceData = electricityPriceData!.map((item: any) => item.y);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Electricity Consumption",
        data: consumptionData,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        yAxisID: "y",
      },
      {
        label: "Electricity Price",
        data: priceData,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        yAxisID: "y1",
      },
    ],
  };

  return { data, xAxisOptions };
};

const fetchElectricityPriceData = async ({
  accessToken,
  startTime,
  currentTimestamp,
  distance,
}: {
  accessToken: string;
  startTime: number;
  currentTimestamp: number;
  distance: number;
}) => {
  const rawElectricityPriceData = await getNodeStats(
    accessToken,
    "61e7fd68cb490600097a03cc",
    "price",
    startTime,
    currentTimestamp,
    distance,
  );

  return formatData(rawElectricityPriceData);
};

const formatData = (rawData: any) => {
  let data = [];

  for (let i = 0; i < rawData.length; i++) {
    data.push({
      x: new Date(rawData[i].time),
      y: rawData[i].value,
    });
  }
  return data;
};

const fetchConsumptioneData = async ({
  accessToken,
  nodeID,
  startTime,
  currentTimestamp,
  distance,
}: {
  accessToken: string;
  nodeID: string,
  startTime: number;
  currentTimestamp: number;
  distance: number;
}) => {
  const rawElectricityConsumptionData = await getNodeStats(
    accessToken,
    nodeID,
    "electricityConsumption",
    startTime,
    currentTimestamp,
    distance,
  );

  const calculateIncrementalConsumption = (data: any) => {
    const incrementalData = [];
    for (let i = 1; i < data.length; i++) {
      const prevValue = data[i - 1].value;
      const currentValue = data[i].value;
      const consumptionDiff = currentValue - prevValue;
      incrementalData.push({
        x: new Date(data[i].time),
        y: consumptionDiff,
      });
    }
    return incrementalData;
  };

  return calculateIncrementalConsumption(rawElectricityConsumptionData);
};

export const fetchElectricityConsumption = async (
  accessToken: string,
  nodeID: string,
  startTime: number,
  currentTimestamp: number,
  distance: number,
  xAxisOptions: any,
) => {
  const consumptionData = await fetchConsumptioneData({
    accessToken,
    nodeID,
    startTime,
    currentTimestamp,
    distance,
  });

  const labels = consumptionData.map((item: any) => item.x.toISOString());
  const values = consumptionData.map((item: any) => item.y.toFixed(0));

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Electricity Consumption",
        data: values,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        yAxisID: "y",
      },
    ],
  };

  return { data, xAxisOptions };
};

export const fetchAirQualityData = async (token: string, id: string) => {
  const node = await getNode(token, id);

  return node;
};

export async function fetchNodes(token: string) {
  const nodes = await getNodes(token);
  return nodes;
}

export const fetchWaterData = async (
  accessToken: string,
  chartParams: WaterChartParams,
  startTime: number,
  currentTimestamp: number,
  distance: number,
  xAxisOptions: any,
) => {
  const cWaterData = chartParams.cWater && await getNodeStats(
    accessToken,
    chartParams.cWater,
    "currentVolume",
    startTime,
    currentTimestamp,
    distance,
  );

  const wWaterData = chartParams.wWater && await getNodeStats(
    accessToken,
    chartParams.wWater,
    "currentVolume",
    startTime,
    currentTimestamp,
    distance,
  );

  const incrementalData = [];
  if (cWaterData) {
    for (let i = 1; i < cWaterData.length; i++) {
      const prevValue = cWaterData[i - 1].value;
      const currentValue = cWaterData[i].value;
      const consumptionDiff = currentValue - prevValue;
      const xValue = distance === 86400 ? new Date(cWaterData[i - 1].time).toISOString().split('T')[0] : new Date(cWaterData[i - 1].time);
      incrementalData.push({
        x: xValue,
        y: consumptionDiff,
      });
    }
  }

  const incrementalDataW = []
  if (wWaterData) {
    for (let i = 1; i < wWaterData.length; i++) {
      const prevValue = wWaterData[i - 1].value;
      const currentValue = wWaterData[i].value;
      const consumptionDiff = currentValue - prevValue;
      const xValue = distance === 86400 ? new Date(wWaterData[i - 1].time).toISOString().split('T')[0] : new Date(wWaterData[i - 1].time);
      incrementalDataW.push({
        x: xValue,
        y: consumptionDiff,
      });
    }
  }

  const combinedData: { x: Date | string, y: number }[] = [];
  if (incrementalData.length > 0 && incrementalDataW.length > 0) {
    for (let i = 0; i < incrementalData.length; i++) {
      combinedData.push({
        x: incrementalData[i].x,
        y: incrementalData[i].y + incrementalDataW[i].y,
      });
    }
  }

  const longestArray = incrementalData.length > incrementalDataW.length
    ? incrementalData
    : incrementalDataW;

  const labels = longestArray.map((item: any) => item.x);

  const datasets: any[] = [];

  if (combinedData.length > 0) {
    datasets.push({
      label: "Total consumption",
      data: combinedData.map((item: any) => item.y),
      borderColor: "rgb(255, 255, 0)",
      backgroundColor: "rgba(82, 246, 59, 0.2)",
      yAxisID: "y",
    });
  }

  if (incrementalData.length > 0) {
    datasets.push({
      label: "Cold water",
      data: incrementalData.map((item: any) => item.y),
      borderColor: "rgb(75, 192, 192)",
      backgroundColor: "rgba(170, 225, 233, 0.7)",
      yAxisID: "y",
    });
  }

  if (incrementalDataW.length > 0) {
    datasets.push({
      label: "Warm water",
      data: incrementalDataW.map((item: any) => item.y),
      borderColor: "rgb(192, 75, 192)",
      backgroundColor: "rgba(255, 115, 115, 0.7)",
      yAxisID: "y",
    });
  }

  return { data: { labels, datasets }, xAxisOptions };
};


export const setContTemp = async (token: string, id: string, contextMap: object, newTemp: number) => {
  await storeCurrentTemperature(token, id, contextMap, newTemp);
};

export enum NodeType {
  "temperature",
  "co2",
  "humidity",
  "warmwater",
  "coldwater",
  "electricity",
}

export async function getAllNodes(
  accessToken: string,
  nodesTypes: NodeType[],
) {
  let promises = nodesTypes.map((node: NodeType) => {
    return getNodeByContext(accessToken, NodeType[nodesTypes[node]])
  })
  let results = await Promise.all(promises)
  let things = new Map(nodesTypes.map((node: NodeType, index: number) => {
    return [nodesTypes[node], results[index]]
  }))
  return things
}
