"use client";

import dynamic from "next/dynamic";
import React, { Suspense, useCallback, useState } from 'react';
import Image from "next/image";
const GaugeComponent = dynamic(() => import("react-gauge-component"), {
    ssr: false,
});
import { useMqtt } from "@/lib/mqtt";
import { ErrorBoundary } from "react-error-boundary";
import { Card } from "@/components/ui/card";
import humLogo from "../../../../public/humidity2.png"


export const HumidityGauge = ({
    nodeID,
    currentValue,
    setID,
    sensorType
}: {
    nodeID: string;
    currentValue: number;
    setID: string;
    sensorType: string;
}) => {
    const [value, setValue] = useState(currentValue);


    console.log("this is nodeID " + nodeID)

    const onMessage = useCallback((topic: any, message: any) => {
        const { iotnode } = JSON.parse(message.toString());

        console.log("iotNode value: " + iotnode)

        const sensorValue = iotnode[sensorType];
        console.log(`update ${sensorType}: ${sensorValue}`);

        setValue(sensorValue);

    }, []);

    useMqtt(setID, nodeID, onMessage);

    return !nodeID ? <></> : (
        <ErrorBoundary fallback={<div></div>}>
            <Card className="w-90 rounded-2xl pt-4 flex items-center bg-muted justify-center">
                <div className="flex items-center justify-center w-full">
                    <Image
                        src={humLogo}
                        alt="Humidity logo"
                        width={65}
                        height={65}
                        className="ml-6"
                    />
                    <Suspense fallback={<div>Loading...</div>}> {/* Suspense while GaugeComponent is loading */}
                        <GaugeComponent
                            type="semicircle"
                            arc={{
                                colorArray: ['#FF2121', '#FFA500', '#FFFF00', '#00FF15', '#FFFF00', '#FFA500', '#FF2121'], // Red, Orange, Yellow, Green, Yellow, Red
                                padding: 0.02,
                                subArcs: [
                                    { limit: 20 },   // Yellow
                                    { limit: 30 },   // Orange
                                    { limit: 40 },   // Green
                                    { limit: 60 },   // Orange
                                    { limit: 70 },   // Yellow
                                    { limit: 80 },
                                    { limit: 90 }   // Red
                                ]
                            }}
                            pointer={{ type: "blob", animationDelay: 0 }}
                            value={value}
                        />
                    </Suspense>
                </div>
            </Card>
        </ErrorBoundary>
    );
};
