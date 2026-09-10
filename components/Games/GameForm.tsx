"use client";

import {useState, useEffect, useRef} from "react";
import {X, Save, Upload, Image as ImageIcon, Archive} from "lucide-react";
import {Game, AdditionalTag, SystemRequirements} from "@/lib/types";
import {apiClient, getImageUrl} from "@/lib/api";
import {uploadGameArchive, cancelGameArchiveUpload} from "@/lib/gameUpload";
import toast from "react-hot-toast";

const EMPTY_SYSTEM_REQUIREMENTS: SystemRequirements = {
  os: "",
  processor: "",
  memory: "",
  graphics: "",
  storage: "",
};

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

interface GameFormProps {
  game?: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function GameForm({
  game,
  isOpen,
  onClose,
  onSave,
}: GameFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    path: "",
    imageUrl: "",
    mainTag: "Game" as "Game" | "Software",
    additionalTags: [] as string[],
    youtubeLink: "",
    gameImages: [] as string[],
    systemRequirements: EMPTY_SYSTEM_REQUIREMENTS,
  });
  const [availableTags, setAvailableTags] = useState<AdditionalTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadingGameImage, setUploadingGameImage] = useState(false);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveUploadedBytes, setArchiveUploadedBytes] = useState(0);
  const [archiveTotalBytes, setArchiveTotalBytes] = useState(0);
  const [archiveUploadId, setArchiveUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gameImagesInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTags();

      // Clear file selection state when modal opens (for both create and edit)
      setSelectedFile(null);
      setError("");
      setArchiveFile(null);
      setArchiveUploading(false);
      setArchiveUploadedBytes(0);
      setArchiveTotalBytes(0);
      setArchiveUploadId(null);

      // Clear file input field
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (archiveInputRef.current) {
        archiveInputRef.current.value = "";
      }

      if (game) {
        // Extract tag IDs from tag objects or use the IDs directly
        const tagIds: string[] = game.additionalTags
          .filter((tag) => tag !== null && tag !== undefined)
          .map((tag) => {
            // If tag is an object with _id, extract the _id
            if (typeof tag === "object" && tag._id) {
              return tag._id;
            }
            // If tag is already a string ID, use it directly
            return tag as string;
          });

        setFormData({
          title: game.title,
          description: game.description,
          path: game.path,
          imageUrl: game.imageUrl,
          mainTag: game.mainTag,
          additionalTags: tagIds,
          youtubeLink: game.youtubeLink || "",
          gameImages: game.gameImages || [],
          systemRequirements: {
            ...EMPTY_SYSTEM_REQUIREMENTS,
            ...game.systemRequirements,
          },
        });
        setPreviewUrl(getImageUrl(game.imageUrl));
      } else {
        setFormData({
          title: "",
          description: "",
          path: "",
          imageUrl: "",
          mainTag: "Game",
          additionalTags: [],
          youtubeLink: "",
          gameImages: [],
          systemRequirements: EMPTY_SYSTEM_REQUIREMENTS,
        });
        setPreviewUrl("");
      }
    } else {
      // Clear file selection state when modal closes
      setSelectedFile(null);
      setPreviewUrl("");
      setError("");
      setArchiveFile(null);
      setArchiveUploading(false);
      setArchiveUploadedBytes(0);
      setArchiveTotalBytes(0);
      setArchiveUploadId(null);
    }
  }, [isOpen, game]);

  // Clean up invalid tag IDs when availableTags change, but preserve existing tags when editing
  useEffect(() => {
    if (availableTags.length > 0 && formData.additionalTags.length > 0) {
      const validTagIds = availableTags.map((tag) => tag._id);
      const validSelectedTags = formData.additionalTags.filter((id) =>
        validTagIds.includes(id)
      );

      // Only update if we're not editing a game or if there are actually invalid tags
      const isEditingGame = game !== null && game !== undefined;
      const hasInvalidTags =
        validSelectedTags.length !== formData.additionalTags.length;

      if (!isEditingGame && hasInvalidTags) {
        setFormData((prev) => ({
          ...prev,
          additionalTags: validSelectedTags,
        }));
      }
    }
  }, [availableTags, game]);

  // Cleanup preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  const fetchTags = async () => {
    try {
      const response = await apiClient.getAdditionalTags();
      const tags = Array.isArray(response) ? response : response.data || [];
      setAvailableTags(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        const errorMessage = "Please select an image file";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        const errorMessage = "File size must be less than 5MB";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      setSelectedFile(file);
      setError("");
      toast.success("Image selected successfully!");

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleArchiveFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchiveFile(file);
    setArchiveUploading(true);
    setArchiveUploadedBytes(0);
    setArchiveTotalBytes(file.size);
    setError("");

    try {
      const uploadedPath = await uploadGameArchive(
        file,
        (uploadedBytes, totalBytes) => {
          setArchiveUploadedBytes(uploadedBytes);
          setArchiveTotalBytes(totalBytes);
        },
        (uploadId) => setArchiveUploadId(uploadId)
      );
      setFormData((prev) => ({...prev, path: uploadedPath}));
      toast.success("Archive uploaded successfully!");
    } catch (err) {
      const errorMessage = "Failed to upload archive. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error uploading archive:", err);
    } finally {
      setArchiveUploading(false);
      setArchiveUploadId(null);
    }
  };

  const handleCancelArchiveUpload = async () => {
    if (archiveFile && archiveUploadId) {
      await cancelGameArchiveUpload(archiveFile, archiveUploadId);
    }
    setArchiveFile(null);
    setArchiveUploading(false);
    setArchiveUploadedBytes(0);
    setArchiveTotalBytes(0);
    setArchiveUploadId(null);
    if (archiveInputRef.current) {
      archiveInputRef.current.value = "";
    }
    toast.success("Upload cancelled");
  };

  const uploadImage = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const response = await apiClient.uploadImage(file);
      if (response.success && response.url) {
        return response.url;
      } else {
        throw new Error("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (archiveUploading) {
      toast.error("Please wait for the archive upload to finish");
      return;
    }
    if (!formData.path) {
      const errorMessage = "Please upload a game archive first";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setLoading(true);
    setError("");

    try {
      let imageUrl = formData.imageUrl;

      // If a new file is selected, upload it first
      if (selectedFile) {
        toast.loading("Uploading image...", {id: "upload"});
        imageUrl = await uploadImage(selectedFile);
        toast.success("Image uploaded successfully!", {id: "upload"});
      }

      const gameData = {
        ...formData,
        imageUrl,
        additionalTags: formData.additionalTags.filter(
          (tag) => tag !== null && tag !== undefined
        ),
        youtubeLink: formData.youtubeLink || undefined,
        gameImages:
          formData.gameImages.length > 0 ? formData.gameImages : undefined,
      };

      if (game) {
        await apiClient.updateGame({
          id: (game as any).id || (game as any)._id,
          ...gameData,
        });
        toast.success("Game updated successfully!");
      } else {
        await apiClient.createGame(gameData);
        toast.success("Game created successfully!");
      }
      onSave();
      onClose();
    } catch (error) {
      const errorMessage = "Failed to save game. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error saving game:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    const tag = availableTags.find((t) => t._id === tagId);
    const isSelected = formData.additionalTags.includes(tagId);

    setFormData((prev) => ({
      ...prev,
      additionalTags: isSelected
        ? prev.additionalTags.filter((id) => id !== tagId)
        : [...prev.additionalTags, tagId],
    }));

    // Show toast notification
    if (tag) {
      if (isSelected) {
        toast.success(`Removed "${tag.name}" tag`);
      } else {
        toast.success(`Added "${tag.name}" tag`);
      }
    }
  };

  const handleGameImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      setUploadingGameImage(true);
      try {
        toast.loading("Uploading image...", {id: "game-image-upload"});
        const imageUrl = await uploadImage(file);

        setFormData((prev) => ({
          ...prev,
          gameImages: [...prev.gameImages, imageUrl],
        }));

        toast.success("Image uploaded and added!", {id: "game-image-upload"});

        // Reset the file input
        if (gameImagesInputRef.current) {
          gameImagesInputRef.current.value = "";
        }
      } catch (error) {
        toast.error("Failed to upload image", {id: "game-image-upload"});
        console.error("Error uploading game image:", error);
      } finally {
        setUploadingGameImage(false);
      }
    }
  };

  const handleRemoveGameImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      gameImages: prev.gameImages.filter((_, i) => i !== index),
    }));
    toast.success("Image URL removed");
  };

  // Filter tags by belongsTo matching mainTag
  const filteredAvailableTags = availableTags.filter(
    (tag) => tag.belongsTo === formData.mainTag
  );

  const handleSelectAllToggle = () => {
    const allTagIds = filteredAvailableTags.map((tag) => tag._id);
    const isAllSelected = isAllTagsSelected();

    setFormData((prev) => ({
      ...prev,
      additionalTags: isAllSelected ? [] : allTagIds,
    }));
  };

  const isAllTagsSelected = () => {
    const allTagIds = filteredAvailableTags.map((tag) => tag._id);
    if (allTagIds.length === 0) return false;

    // Check if all available tag IDs are in the selected tags
    return allTagIds.every((id) => formData.additionalTags.includes(id));
  };

  const isIndeterminate = () => {
    const allTagIds = filteredAvailableTags.map((tag) => tag._id);
    if (allTagIds.length === 0) return false;

    // Count how many available tags are selected
    const selectedAvailableTags = formData.additionalTags.filter((id) =>
      allTagIds.includes(id)
    );

    return (
      selectedAvailableTags.length > 0 &&
      selectedAvailableTags.length < allTagIds.length
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {game ? "Edit Game" : "Create New Game"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({...formData, title: e.target.value})
                }
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({...formData, description: e.target.value})
                }
                className="input-field min-h-[100px]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Archive {!game && "*"}
              </label>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={archiveInputRef}
                  type="file"
                  onChange={handleArchiveFileSelect}
                  className="hidden"
                  disabled={archiveUploading}
                />

                {archiveFile ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 truncate">
                      {archiveFile.name}
                    </div>
                    {archiveUploading ? (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                archiveTotalBytes > 0
                                  ? Math.round(
                                      (archiveUploadedBytes /
                                        archiveTotalBytes) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatBytes(archiveUploadedBytes)} /{" "}
                          {formatBytes(archiveTotalBytes)}
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelArchiveUpload}
                          className="text-sm text-red-600 hover:text-red-700 underline"
                        >
                          Cancel upload
                        </button>
                      </>
                    ) : (
                      <div className="text-sm text-green-600">
                        Uploaded — saved as {formData.path}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Archive className="w-8 h-8 text-gray-400 mx-auto" />
                    <div>
                      <button
                        type="button"
                        onClick={() => archiveInputRef.current?.click()}
                        className="btn-primary flex items-center mx-auto"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Archive
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      ZIP, RAR, 7z, EXE — any size, resumes automatically if
                      interrupted
                    </p>
                  </div>
                )}
              </div>

              {/* Fallback manual entry for an existing game's on-disk filename */}
              {game && !archiveFile && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Or enter filename manually:
                  </label>
                  <input
                    type="text"
                    value={formData.path}
                    onChange={(e) =>
                      setFormData({...formData, path: e.target.value})
                    }
                    className="input-field"
                    placeholder="existing-file.zip"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image *
              </label>

              {/* File Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="relative inline-block">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-32 max-w-full rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl("");
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : "Current image"}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Change image
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary flex items-center mx-auto"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Image
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                )}
              </div>

            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Tag *
              </label>
              <select
                value={formData.mainTag}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mainTag: e.target.value as "Game" | "Software",
                  })
                }
                className="input-field"
                required
              >
                <option value="Game">Game</option>
                <option value="Software">Software</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube Link
              </label>
              <input
                type="url"
                value={formData.youtubeLink}
                onChange={(e) =>
                  setFormData({...formData, youtubeLink: e.target.value})
                }
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Requirements
              </label>
              <p className="text-xs text-gray-500 mb-3">
                All optional. Leave any field blank to hide it on the
                storefront.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ["os", "OS"],
                    ["processor", "Processor"],
                    ["memory", "Memory (RAM)"],
                    ["graphics", "Graphics (GPU)"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={formData.systemRequirements[field]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          systemRequirements: {
                            ...formData.systemRequirements,
                            [field]: e.target.value,
                          },
                        })
                      }
                      className="input-field"
                      placeholder={
                        field === "os"
                          ? "e.g. Windows 10 64-bit"
                          : field === "processor"
                          ? "e.g. Intel Core i5-6600K"
                          : field === "memory"
                          ? "e.g. 8 GB RAM"
                          : "e.g. NVIDIA GTX 1060 6GB"
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Storage
                  </label>
                  <input
                    type="text"
                    value={formData.systemRequirements.storage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        systemRequirements: {
                          ...formData.systemRequirements,
                          storage: e.target.value,
                        },
                      })
                    }
                    className="input-field"
                    placeholder="e.g. 50 GB available space"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Images
              </label>
              <div className="space-y-3">
                {/* File Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={gameImagesInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleGameImageFileSelect}
                    className="hidden"
                    disabled={uploadingGameImage}
                  />
                  <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <button
                    type="button"
                    onClick={() => gameImagesInputRef.current?.click()}
                    disabled={uploadingGameImage}
                    className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingGameImage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </div>

                {/* Image List */}
                {formData.gameImages.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      Added Images ({formData.gameImages.length})
                    </p>
                    {formData.gameImages.map((url, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-50 p-2 rounded group"
                      >
                        <img
                          src={getImageUrl(url)}
                          alt={`Game image ${index + 1}`}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23ddd' width='48' height='48'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3EError%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {url}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGameImage(index)}
                          className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Tags
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {filteredAvailableTags.map((tag) => (
                  <div key={tag._id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`tag-${tag._id}`}
                      checked={formData.additionalTags.includes(tag._id)}
                      onChange={() => handleTagToggle(tag._id)}
                      className="mr-2 rounded"
                    />
                    <label
                      htmlFor={`tag-${tag._id}`}
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      {tag.name}
                    </label>
                  </div>
                ))}
                {filteredAvailableTags.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No additional tags available for {formData.mainTag}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading || archiveUploading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {archiveUploading
                  ? "Uploading archive..."
                  : uploading
                  ? "Uploading..."
                  : loading
                  ? "Saving..."
                  : "Save Game"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
