const { useEffect, useMemo, useRef, useState } = React;
const DEFAULT_GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxPNm8hIFuOAcYKVika9wflNyLlBtgz9EcA-TrGnzxs2JKLRIEk4cFFOHuupJVQVgfP/exec";

function App() {
  const [endpoint, setEndpoint] = useState(
    localStorage.getItem("gasEndpoint") || DEFAULT_GAS_ENDPOINT
  );
  const [annotator, setAnnotator] = useState(localStorage.getItem("annotator") || "");
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadingCurrentImage, setLoadingCurrentImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [supportSpeech, setSupportSpeech] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [fitMode, setFitMode] = useState("fit");

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const canUseSpeechButton = supportSpeech && !isIOS;

  useEffect(() => {
    setSupportSpeech(Boolean(SpeechRecognition));
  }, [SpeechRecognition]);

  useEffect(() => {
    localStorage.setItem("gasEndpoint", endpoint);
  }, [endpoint]);

  useEffect(() => {
    localStorage.setItem("annotator", annotator);
  }, [annotator]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const currentImage = useMemo(() => images[currentIndex] || null, [images, currentIndex]);
  const completedCount = images.filter((x) => x.annotated).length;
  const progress = images.length ? `${currentIndex + 1} / ${images.length}` : "0 / 0";
  const selectedFolder = folders.find((x) => x.id === selectedFolderId) || null;

  const parseJson = async (response) => {
    if (!response.ok) {
      throw new Error(`通信失敗 (${response.status})`);
    }
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || "APIエラー");
    }
    return payload;
  };

  const loadFolders = async () => {
    if (!endpoint) {
      setError("先にGAS WebアプリURLを入力してください。");
      return;
    }
    setLoadingFolders(true);
    setError("");
    try {
      const response = await fetch(`${endpoint}?action=listFolders`);
      const payload = await parseJson(response);
      setFolders(payload.folders || []);
      if (!selectedFolderId && payload.folders && payload.folders.length) {
        setSelectedFolderId(payload.folders[0].id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadImages = async () => {
    if (!endpoint || !selectedFolderId) {
      setError("GAS URLとフォルダを選択してください。");
      return;
    }
    setLoadingImages(true);
    setError("");
    try {
      const response = await fetch(
        `${endpoint}?action=listImages&folderId=${encodeURIComponent(selectedFolderId)}`
      );
      const payload = await parseJson(response);
      const list = (payload.images || []).map((img) => ({
        ...img,
        url: img.url || img.thumbnailUrl || "",
      }));
      setImages(list);
      const firstPending = list.findIndex((x) => !x.annotated);
      setCurrentIndex(firstPending >= 0 ? firstPending : 0);
      setCaption(firstPending >= 0 ? "" : list[0]?.caption || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingImages(false);
    }
  };

  const jumpToNextPending = (list, start) => {
    for (let i = start + 1; i < list.length; i += 1) {
      if (!list[i].annotated) return i;
    }
    return Math.min(start + 1, Math.max(0, list.length - 1));
  };

  const ensureImageLoaded = async (imageId) => {
    if (!endpoint || !imageId) return;
    const target = images.find((x) => x.id === imageId);
    if (target && target.url) return;
    setLoadingCurrentImage(true);
    try {
      const response = await fetch(
        `${endpoint}?action=getImageData&imageId=${encodeURIComponent(imageId)}`
      );
      const payload = await parseJson(response);
      const dataUrl = payload.image && payload.image.dataUrl ? payload.image.dataUrl : "";
      if (!dataUrl) {
        throw new Error("GASのデプロイが旧版の可能性があります。Code.gs更新後にデプロイを更新してください。");
      }
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, url: dataUrl } : img)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCurrentImage(false);
    }
  };

  useEffect(() => {
    if (currentImage && currentImage.id && !currentImage.url) {
      ensureImageLoaded(currentImage.id);
    }
  }, [currentImage?.id]);

  const saveCurrent = async () => {
    if (!endpoint || !currentImage) {
      setError("先にフォルダと画像を読み込んでください。");
      return;
    }
    if (!caption.trim()) {
      setError("所見が空です。音声入力または手入力してください。");
      return;
    }
    if (!annotator) {
      setError("入力者を選択してください。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const params = new URLSearchParams({
        action: "saveAnnotation",
        annotator,
        folderId: selectedFolderId,
        folderName: selectedFolder ? selectedFolder.name : "",
        imageId: currentImage.id,
        imageName: currentImage.name,
        caption: caption.trim(),
        timestamp: new Date().toISOString(),
      });
      const response = await fetch(`${endpoint}?${params.toString()}`);
      await parseJson(response);

      setImages((prev) => {
        const next = prev.map((img, idx) =>
          idx === currentIndex ? { ...img, annotated: true, caption: caption.trim() } : img
        );
        const nextIndex = jumpToNextPending(next, currentIndex);
        setCurrentIndex(nextIndex);
        setCaption(next[nextIndex]?.annotated ? next[nextIndex].caption || "" : "");
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectImage = (index) => {
    setCurrentIndex(index);
    const img = images[index];
    setCaption(img?.annotated ? img.caption || "" : "");
    setImageScale(1);
    setFitMode("fit");
  };

  const move = (delta) => {
    if (!images.length) return;
    const nextIndex = Math.max(0, Math.min(images.length - 1, currentIndex + delta));
    selectImage(nextIndex);
  };

  const startSpeech = () => {
    if (isIOS) {
      setError("");
      if (textareaRef.current) textareaRef.current.focus();
      return;
    }
    if (!SpeechRecognition) {
      setError("このブラウザでは音声認識が使えません。手入力をご利用ください。");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i += 1) {
          text += event.results[i][0].transcript;
        }
        setCaption(text.trim());
      };
      recognition.onerror = (e) => {
        if (e.error === "service-not-allowed" || e.error === "not-allowed") {
          setError(
            "音声認識エラー: service-not-allowed。iPhone/iPadではSafariのキーボード音声入力（マイク）をご利用ください。"
          );
        } else {
          setError(`音声認識エラー: ${e.error}`);
        }
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (e) {
      setError(`音声認識を開始できませんでした: ${e.message}`);
    }
  };

  const stopSpeech = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  };

  return (
    <div className="container">
      <h1>Drive Annotation App</h1>

      <section className="card">
        <label className="label">GAS WebアプリURL</label>
        <div className="row">
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/xxxx/exec"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <button onClick={loadFolders} disabled={loadingFolders}>
            {loadingFolders ? "読込中..." : "フォルダ読込"}
          </button>
        </div>
      </section>

      <section className="card">
        <label className="label">入力者</label>
        <div className="row">
          <select value={annotator} onChange={(e) => setAnnotator(e.target.value)}>
            <option value="">選択してください</option>
            <option value="須藤">須藤</option>
            <option value="田畑">田畑</option>
          </select>
        </div>
      </section>

      <section className="card">
        <label className="label">Driveフォルダ選択</label>
        <div className="row">
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            disabled={!folders.length}
          >
            {!folders.length && <option value="">フォルダを読み込んでください</option>}
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <button onClick={loadImages} disabled={!selectedFolderId || loadingImages}>
            {loadingImages ? "画像読込中..." : "画像読込"}
          </button>
        </div>
        <p className="hint">候補フォルダ: panorama / oral_photo / dentalxray</p>
      </section>

      <section className="card grid">
        <div>
          <div className="progress">
            画像: {progress} | 入力済み: {completedCount}/{images.length}
          </div>
          <div className="row image-tools">
            <button className="secondary" onClick={() => setImageScale((s) => Math.max(0.6, s - 0.1))}>
              縮小
            </button>
            <button className="secondary" onClick={() => setImageScale((s) => Math.min(2.5, s + 0.1))}>
              拡大
            </button>
            <button className="secondary" onClick={() => setFitMode("fit")}>
              全体
            </button>
            <button className="secondary" onClick={() => setFitMode("width")}>
              幅
            </button>
            <button className="secondary" onClick={() => setFitMode("height")}>
              高さ
            </button>
            <button
              className="secondary"
              onClick={() => {
                setImageScale(1);
                setFitMode("fit");
              }}
            >
              リセット
            </button>
          </div>
          {currentImage ? (
            currentImage.url ? (
              <div className="preview-shell">
                <img
                  className={`preview preview-${fitMode}`}
                  style={{ transform: `scale(${imageScale})` }}
                  src={currentImage.url}
                  alt={currentImage.name}
                />
              </div>
            ) : (
              <div className="empty">{loadingCurrentImage ? "画像を取得中..." : "画像を取得できません"}</div>
            )
          ) : (
            <div className="empty">フォルダを選択して画像を読み込んでください</div>
          )}
          {currentImage && (
            <div className="hint">
              {currentImage.name} | {currentImage.annotated ? "入力済み" : "未入力"}
            </div>
          )}
        </div>

        <div className="editor">
          <div className="label">所見</div>
          <textarea
            ref={textareaRef}
            rows="5"
            placeholder="ここに所見を入力（音声入力可）"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="row editor-actions">
            {!isIOS && (
              <button onClick={startSpeech} disabled={!canUseSpeechButton || listening}>
                音声開始
              </button>
            )}
            {!isIOS && (
              <button onClick={stopSpeech} disabled={!listening}>
                音声停止
              </button>
            )}
            <button onClick={saveCurrent} disabled={!currentImage || saving}>
              {saving ? "保存中..." : "保存して次の未入力へ"}
            </button>
            <button className="secondary" onClick={() => move(-1)} disabled={!images.length}>
              前へ
            </button>
            <button className="secondary" onClick={() => move(1)} disabled={!images.length}>
              次へ
            </button>
          </div>
          {!supportSpeech && (
            <p className="hint">このブラウザでは音声認識非対応です。手入力で運用してください。</p>
          )}
          {isIOS && <p className="hint">iPhone/iPadはキーボードのマイク入力をご利用ください。</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      {!!images.length && (
        <section className="card">
          <div className="label">サムネイル一覧（入力済み判定）</div>
          <div className="thumbs">
            {images.map((img, idx) => (
              <button
                key={img.id}
                className={`thumb ${idx === currentIndex ? "active" : ""} ${
                  img.annotated ? "done" : "todo"
                }`}
                onClick={() => selectImage(idx)}
              >
                <div className="thumb-label">{idx + 1}</div>
                <span>{img.annotated ? "済" : "未"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
