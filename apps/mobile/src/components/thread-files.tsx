import { filesKey } from "@repo/app-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { appApi } from "@/lib/api";

type Picked = { uri: string; name: string; contentType: string };

/**
 * ピッカーが返す uri をそのままアップロードする。手順は `@repo/app-api` が持つ（web と共通）。
 *
 * **サイズはピッカーの申告ではなく実体から取る。** 宣言したサイズと実際のバイト数が
 * 食い違うとサーバーが content-length を見て 413 で弾く（日本語のファイルで実際に踏んだ）。
 * `expo-file-system` の `File` は Blob なので、そのまま PUT のボディにも載る
 * （`fetch("file://...")` はプラットフォームによって挙動が違うので使わない）。
 */
function toUpload(threadId: string, picked: Picked) {
  const file = new File(picked.uri);
  return appApi.uploadFile({
    threadId,
    name: picked.name,
    size: file.size ?? 0,
    contentType: picked.contentType,
    body: file,
  });
}

export function ThreadFiles({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const key = filesKey(threadId);

  const files = useQuery({
    queryKey: key,
    queryFn: () => appApi.listFiles(threadId),
  });

  const upload = useMutation({
    mutationFn: async (source: "file" | "photo") => {
      const picked = source === "file" ? await pickFile() : await pickPhoto();
      if (picked) await toUpload(threadId, picked);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <View className="gap-2 border-b border-border p-4">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          testID="attach-file"
          className="flex-row items-center gap-2 rounded-lg border border-border px-3 py-2 active:opacity-80"
          disabled={upload.isPending}
          onPress={() => upload.mutate("file")}
        >
          {upload.isPending && <ActivityIndicator />}
          <Text className="text-foreground">ファイルを添付</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="attach-photo"
          className="flex-row items-center gap-2 rounded-lg border border-border px-3 py-2 active:opacity-80"
          disabled={upload.isPending}
          onPress={() => upload.mutate("photo")}
        >
          <Text className="text-foreground">写真を添付</Text>
        </Pressable>
      </View>

      {upload.error && (
        <View className="rounded-lg border border-destructive p-3">
          <Text className="text-destructive">{upload.error.message}</Text>
        </View>
      )}

      {files.data && files.data.length > 0 && (
        <ScrollView
          horizontal
          contentContainerClassName="gap-2"
          showsHorizontalScrollIndicator={false}
        >
          {files.data.map((file) => (
            <Pressable
              key={file.id}
              accessibilityRole="button"
              className="rounded-lg border border-border px-3 py-2"
              onPress={() => WebBrowser.openBrowserAsync(appApi.fileContentUrl(file.id))}
            >
              <Text className="text-foreground">{file.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Files アプリから選ぶ。写真ライブラリはここには出てこない（別のピッカー）。 */
async function pickFile(): Promise<Picked | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  return {
    uri: asset.uri,
    name: asset.name,
    contentType: asset.mimeType || "application/octet-stream",
  };
}

/**
 * 写真ライブラリから選ぶ。
 *
 * **権限を自分で要求しない。** iOS は PHPicker、Android は Photo Picker が使われ、
 * どちらも「選んだ 1 枚だけ」をアプリに渡す仕組みなのでライブラリ全体の許可は要らない。
 * `quality: 1` で再エンコードさせない（縮小されると `File` のサイズと中身がずれる）。
 */
async function pickPhoto(): Promise<Picked | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${asset.assetId ?? "picked"}.jpg`,
    contentType: asset.mimeType || "image/jpeg",
  };
}
