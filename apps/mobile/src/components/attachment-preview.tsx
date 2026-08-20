import { useQuery } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "@/components/safe-area-view";
import { ATTACHMENT_CACHE_URI, downloadAttachment } from "@/lib/api";

export type PreviewTarget = { id: string; name: string; contentType: string };

/**
 * 落とし終えた 1 件を描画する。**呼ぶ側は `key={uri}` で置く**（uri が変わったら
 * `loaded` ごと作り直したい）。
 */
function PreviewContent({ uri }: { uri: string }) {
  // **描画が始まったことを自分で確かめる。** WebView が「載っているのに真っ白」は
  // 起きうるので（下の originWhitelist の件）、`onLoad` が来るまでスピナーを
  // 退けない。Maestro もこれが消えることを見る。
  const [loaded, setLoaded] = useState(false);

  return (
    <View className="flex-1">
      <WebView
        testID="attachment-webview"
        style={{ flex: 1 }}
        source={{ uri }}
        /**
         * **`file://` を明示的に許す。** 既定は `["http://*", "https://*"]` だけで、
         * 外れた URL はロードされず `Linking.openURL()` に回される
         * （`WebViewShared.tsx` の `createOnShouldStartLoadWithRequest`）。
         * file:// は誰も開かないので**エラーも警告も出ずに白い画面のまま**になる。
         *
         * ローカルだけに絞ることは、HTML の添付が外部へ出ていくのを塞ぐことにもなる。
         */
        originWhitelist={["file://*"]}
        // 落とした添付より外は読ませない
        allowingReadAccessToURL={ATTACHMENT_CACHE_URI}
        allowFileAccess
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center bg-background">
          <ActivityIndicator testID="attachment-loading" />
        </View>
      )}
    </View>
  );
}

/**
 * 添付をアプリ内で表示する。**web はタップ 1 回で中身が出る**ので、共有シート越しに
 * 2 タップさせるのではなく同じ体験にする。
 *
 * WKWebView は画像も PDF もテキストもそのまま描画するため、web のタブと同じものが出る。
 * 保存や他アプリへ送るのはヘッダの「共有」に退かせてある。
 *
 * **`WebView` に `className` は効かない。** NativeWind が差し替えるのは `react-native` の
 * 解決だけで、サードパーティには届かず黙って無視される（`safe-area-view.tsx` と同じ罠）。
 * ここは `style` で書く。
 */
export function AttachmentPreview({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  // **開くたびに落とし直す。** staleTime は既定の 0 なので、閉じて（disabled）から
  // 開き直すと再取得が走る。落とし先は OS のキャッシュで、いつ消されても
  // おかしくないため「前に成功した uri」を信じ続けてはいけない。
  const local = useQuery({
    queryKey: ["attachment-content", target?.id],
    queryFn: () => downloadAttachment(target as PreviewTarget),
    enabled: target != null,
  });

  return (
    <Modal
      visible={target != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border p-4">
          <Text className="flex-1 text-foreground" numberOfLines={1}>
            {target?.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="share-attachment"
            disabled={!local.data}
            onPress={() =>
              local.data && Sharing.shareAsync(local.data, { mimeType: target?.contentType })
            }
          >
            <Text className={local.data ? "text-primary" : "text-muted-foreground"}>共有</Text>
          </Pressable>
          <Pressable accessibilityRole="button" testID="close-attachment" onPress={onClose}>
            <Text className="text-muted-foreground">閉じる</Text>
          </Pressable>
        </View>

        {local.isPending && <ActivityIndicator testID="attachment-loading" className="p-6" />}

        {local.error && (
          <View className="m-4 rounded-lg border border-destructive p-3">
            <Text className="text-destructive">{local.error.message}</Text>
          </View>
        )}

        {local.data && <PreviewContent key={local.data} uri={local.data} />}
      </SafeAreaView>
    </Modal>
  );
}
