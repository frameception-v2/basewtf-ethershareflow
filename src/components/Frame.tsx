"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { PurpleButton } from "~/components/ui/PurpleButton";
import { truncateAddress } from "~/lib/truncateAddress";
import { base } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useSearchParams } from "next/navigation";

function SendEthCard({ toAddress, isSending, isConfirming, isConfirmed, onSend }: { 
  toAddress: string;
  isSending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  onSend: () => void;
}) {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <CardTitle className="text-neutral-900">Send ETH</CardTitle>
        <CardDescription className="text-neutral-600">
          Send ETH to: {truncateAddress(toAddress)}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-neutral-800">
        <div className="flex flex-col gap-4">
          <PurpleButton 
            onClick={onSend}
            disabled={isSending || isConfirming || !toAddress}
          >
            {isSending ? 'Sending...' : 
             isConfirming ? 'Confirming...' : 
             isConfirmed ? 'Sent!' : 'Send 0.01 ETH'}
          </PurpleButton>
          
          {isConfirmed && (
            <div className="text-sm text-green-600">
              Transaction confirmed!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Frame(
  { title }: { title?: string } = { title: "EtherShareFlow" }
) {
  const searchParams = useSearchParams();
  const toAddress = searchParams.get('to') || '';
  
  const { 
    sendTransaction, 
    isPending: isSending,
    data: txHash
  } = useSendTransaction();
  
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({ 
    hash: txHash 
  });
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-neutral-900">{title}</h1>
        {toAddress ? (
          <SendEthCard
            toAddress={toAddress}
            isSending={isSending}
            isConfirming={isConfirming}
            isConfirmed={isConfirmed}
            onSend={() => {
              sendTransaction({
                to: toAddress as `0x${string}`,
                value: BigInt(10000000000000000) // 0.01 ETH
              });
            }}
          />
        ) : (
          <Card className="border-neutral-200 bg-white">
            <CardHeader>
              <CardTitle className="text-neutral-900">Error</CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-800">
              <p>No recipient address specified</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
