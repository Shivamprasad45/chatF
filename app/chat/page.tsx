"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, ChangeEvent } from "react";
import {
  initSocket,
  getSocket,
  disconnectSocket,
} from "@/app/services/socketService";
import {
  useGetUserGroupsQuery,
  useGetPublicGroupsQuery,
  useGetGroupMessagesQuery,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useSendMessageMutation,
  useGetGroupMembersQuery,
  useRemoveUserFromGroupMutation,
  useAddUserToGroupMutation,
} from "@/app/featuers/chat/ChatAPI";
import axios from "axios";
import { uploadFileToS3 } from "@/app/lib/s3Upload"; // New S3 upload utility

interface User {
  name: string;
  _id: string;
}

interface Group {
  _id: string;
  name: string;
  admin: string;
  members: string[];
  isPublic: boolean;
}

interface FilePreview {
  url: string;
  type: string;
  name: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"myGroups" | "publicGroups">(
    "myGroups"
  );
  const [showMemberList, setShowMemberList] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isPublicGroup, setIsPublicGroup] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize socket
  useEffect(() => {
    initSocket();
    return () => disconnectSocket();
  }, []);

  // RTK Query hooks
  const { data: groupMembers } = useGetGroupMembersQuery(
    selectedGroupId || "",
    { skip: !selectedGroupId }
  );

  const [addUserToGroup] = useAddUserToGroupMutation();
  const [removeUserFromGroup] = useRemoveUserFromGroupMutation();
  const { data: userGroups = [] } = useGetUserGroupsQuery(user?._id || "", {
    skip: !user?._id,
  });
  const { data: publicGroups = [] } = useGetPublicGroupsQuery();
  const { data: messages = [] } = useGetGroupMessagesQuery(
    selectedGroupId || "",
    {
      skip: !selectedGroupId,
    }
  );

  const [createGroup] = useCreateGroupMutation();
  const [joinGroup] = useJoinGroupMutation();
  const [sendMessage] = useSendMessageMutation();

  // Socket event handlers
  useEffect(() => {
    if (!selectedGroupId) return;

    const socket = getSocket();
    socket.emit("join-group", selectedGroupId);

    const handleGroupMessage = (newMessage: any) => {
      if (newMessage.groupId === selectedGroupId) {
        // RTK Query will handle updates
      }
    };

    socket.on("group-message", handleGroupMessage);

    // Listen for group updates (add/remove user)
    const handleGroupUpdate = (data: { groupId: string; message: string }) => {
      if (data.groupId === selectedGroupId) {
        // Invalidate cache to refetch members
        // This will trigger a refetch of group members
      }
    };

    socket.on("group-update", handleGroupUpdate);

    return () => {
      socket.off("group-message", handleGroupMessage);
      socket.off("group-update", handleGroupUpdate);
      socket.emit("leave-group", selectedGroupId);
    };
  }, [selectedGroupId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check user authentication
  useEffect(() => {
    const userData = sessionStorage.getItem("token");
    if (!userData) {
      router.push("/login");
    } else {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
  }, [router]);

  // Handle file selection
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileType = file.type.split("/")[0]; // 'image', 'video', etc.

    // Validate file type and size
    const validTypes = ["image", "video", "audio", "application"];
    if (!validTypes.includes(fileType)) {
      alert("Please select a valid file type (image, video, audio, document)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert("File size exceeds 10MB limit");
      return;
    }

    try {
      setIsUploading(true);

      // Create preview for images and videos
      if (fileType === "image" || fileType === "video") {
        const previewUrl = URL.createObjectURL(file);
        setFilePreview({
          url: previewUrl,
          type: fileType,
          name: file.name,
        });
      } else {
        setFilePreview({
          url: "",
          type: fileType,
          name: file.name,
        });
      }

      // Upload file to S3
      const fileUrl = await uploadFileToS3(file);

      // Update preview with permanent URL
      setFilePreview({
        url: fileUrl,
        type: fileType,
        name: file.name,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("File upload failed");
      setFilePreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Clear file preview
  const clearFilePreview = () => {
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;

    try {
      await createGroup({
        name: newGroupName,
        isPublic: isPublicGroup,
        admin: user._id,
        members: [user._id],
      }).unwrap();

      setIsCreatingGroup(false);
      setNewGroupName("");
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  // Join group handler
  const handleJoinGroup = async (groupId: string) => {
    if (!user) return;

    try {
      await joinGroup({
        groupId,
        userId: user._id,
      }).unwrap();
    } catch (error) {
      console.error("Error joining group:", error);
    }
  };

  const handleAddUserToGroup = async () => {
    if (!newUserEmail.trim() || !user || !selectedGroupId) return;

    try {
      setIsAddingUser(true);

      // First, find user by email
      const findUserResponse = await axios.get(
        `http://localhost:5000/api/users?email=${newUserEmail}`
      );

      if (!findUserResponse.data || findUserResponse.data.length === 0) {
        throw new Error("User not found");
      }

      const targetUser = findUserResponse.data;

      // Add user to group
      await addUserToGroup({
        groupId: selectedGroupId,
        userId: targetUser._id,
        adminId: user._id,
      }).unwrap();

      setNewUserEmail("");
      setShowAddUserModal(false);

      // Notify group about new member
      getSocket().emit("group-update", {
        groupId: selectedGroupId,
        message: `${targetUser.name} has been added to the group`,
      });
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Failed to add user. Make sure the email is correct.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!user || !selectedGroupId || userId === user._id) return;

    if (!confirm(`Are you sure you want to remove ${userId} from the group?`)) {
      return;
    }

    try {
      await removeUserFromGroup({
        groupId: selectedGroupId,
        userId,
        adminId: user._id,
      }).unwrap();

      // Notify group about removal
      getSocket().emit("group-update", {
        groupId: selectedGroupId,
        message: `${userId} has been removed from the group`,
      });
    } catch (error) {
      console.error("Error removing user:", error);
      alert("Failed to remove user");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !filePreview) return;
    if (!user || !selectedGroupId) return;

    const selectedGroup = [...userGroups, ...publicGroups].find(
      (g) => g._id === selectedGroupId
    );

    if (!selectedGroup || !isGroupMember(selectedGroup)) {
      alert("You must join the group to send messages");
      return;
    }

    try {
      await sendMessage({
        sender: user._id,
        text: message,
        groupId: selectedGroupId,
        senderName: user.name,
        ...(filePreview && {
          file: {
            url: filePreview.url,
            type: filePreview.type,
          },
        }),
      }).unwrap();

      setMessage("");
      clearFilePreview();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const isGroupMember = (group: Group) => {
    return user && group.members.includes(user._id);
  };

  const selectedGroup = selectedGroupId
    ? [...userGroups, ...publicGroups].find((g) => g._id === selectedGroupId) ||
      null
    : null;

  const isAdmin = selectedGroup?.admin === user?._id;

  return (
    <main className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 text-xl font-bold border-b">BChat</div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-2 font-medium ${
              activeTab === "myGroups" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("myGroups")}
          >
            My Groups
          </button>
          <button
            className={`flex-1 py-2 font-medium ${
              activeTab === "publicGroups" ? "bg-gray-200" : ""
            }`}
            onClick={() => setActiveTab("publicGroups")}
          >
            Public Groups
          </button>
        </div>

        {/* Group List */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === "myGroups"
            ? userGroups.map((group) => (
                <div
                  key={group._id}
                  className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
                    selectedGroupId === group._id ? "bg-blue-100" : ""
                  }`}
                  onClick={() => setSelectedGroupId(group._id)}
                >
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500">
                    {group.isPublic ? "Public" : "Private"} •{" "}
                    {group.members.length} members
                  </div>
                </div>
              ))
            : publicGroups.map((group) => (
                <div
                  key={group._id}
                  className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
                    selectedGroupId === group._id ? "bg-blue-100" : ""
                  }`}
                  onClick={() => setSelectedGroupId(group._id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-gray-500">
                        {group.members.length} members
                      </div>
                    </div>
                    {!isGroupMember(group) && (
                      <button
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinGroup(group._id);
                        }}
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))}
        </div>

        {/* Create Group Button */}
        <button
          className="m-4 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => setIsCreatingGroup(true)}
        >
          Create Group
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedGroup ? (
          <>
            <div className="p-4 bg-white border-b flex justify-between items-center">
              <div>
                <div className="font-bold text-xl flex items-center gap-2">
                  {selectedGroup.name}
                  {isAdmin && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {selectedGroup.isPublic ? "Public Group" : "Private Group"} •
                  <button
                    className="ml-1 text-blue-600 hover:underline"
                    onClick={() => setShowMemberList(!showMemberList)}
                  >
                    {selectedGroup.members.length} members
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    onClick={() => setShowAddUserModal(true)}
                  >
                    Add User
                  </button>
                )}

                {!isGroupMember(selectedGroup) && (
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    onClick={() => handleJoinGroup(selectedGroup._id)}
                  >
                    Join Group
                  </button>
                )}
              </div>
            </div>

            {/* Member List Dropdown */}
            {showMemberList && (
              <div className="bg-white border-b p-4 max-h-60 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Group Members</h3>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setShowMemberList(false)}
                  >
                    ✕
                  </button>
                </div>

                <ul className="divide-y">
                  {groupMembers?.map((member: any) => (
                    <li
                      key={member}
                      className="py-2 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-medium">{member}</span>
                        {selectedGroup?.admin === member && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>

                      {isAdmin && selectedGroup?.admin !== member._id && (
                        <button
                          className="text-red-600 hover:text-red-800 text-sm"
                          onClick={() => handleRemoveUser(member)}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {isAdmin && (
                  <button
                    className="mt-3 w-full py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-sm"
                    onClick={() => {
                      setShowAddUserModal(true);
                      setShowMemberList(false);
                    }}
                  >
                    + Add Member
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.map((msg: any) => (
                <div
                  key={msg._id}
                  className={`p-3 rounded-lg mb-3 max-w-[80%] ${
                    msg.sender === user?._id
                      ? "bg-green-100 ml-auto"
                      : "bg-white"
                  }`}
                >
                  <div className="font-medium text-sm">
                    {msg.sender === user?._id ? "You" : msg.senderName}
                  </div>

                  {/* Render file previews */}
                  {msg.fileUrl && (
                    <div className="mt-2">
                      {msg.fileType === "image" && (
                        <img
                          src={msg.fileUrl}
                          alt="Shared content"
                          className="max-w-full max-h-64 rounded-lg object-contain"
                        />
                      )}

                      {msg.fileType === "video" && (
                        <video
                          controls
                          className="max-w-full max-h-64 rounded-lg"
                        >
                          <source src={msg.fileUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      )}

                      {msg.fileType === "audio" && (
                        <audio controls className="w-full mt-2">
                          <source src={msg.fileUrl} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}

                      {(msg.fileType === "application" ||
                        msg.fileType === "other") && (
                        <a
                          href={msg.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 mt-2"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-1"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Download File
                        </a>
                      )}
                    </div>
                  )}

                  {msg.text && <div className="mt-1">{msg.text}</div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isGroupMember(selectedGroup) ? (
              <div className="border-t bg-white">
                {/* File preview bar */}
                {filePreview && (
                  <div className="p-2 bg-blue-50 border-b flex items-center justify-between">
                    <div className="flex items-center">
                      {filePreview.type === "image" ? (
                        <img
                          src={filePreview.url}
                          alt="Preview"
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-12 h-12 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-gray-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                      )}
                      <span className="ml-2 text-sm truncate max-w-xs">
                        {filePreview.name}
                      </span>
                    </div>
                    <button
                      onClick={clearFilePreview}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Message input form */}
                <form onSubmit={handleSendMessage} className="flex p-4">
                  {/* File upload button */}
                  <label className="cursor-pointer p-2 text-gray-600 hover:text-gray-800 mr-1">
                    <input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    )}
                  </label>

                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isUploading || (!message.trim() && !filePreview)}
                    className={`px-4 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700 ${
                      isUploading || (!message.trim() && !filePreview)
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 text-center bg-yellow-50 text-gray-600">
                You must join the group to send messages
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Welcome to BChat</h2>
              <p className="text-gray-600 mb-6">
                {activeTab === "myGroups"
                  ? "You're not in any groups yet. Create or join a group to start chatting!"
                  : "Browse public groups and join conversations"}
              </p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => setIsCreatingGroup(true)}
              >
                Create New Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {isCreatingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Group</h3>
            <div className="mb-4">
              <label className="block mb-2 font-medium">Group Name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                checked={isPublicGroup}
                onChange={(e) => setIsPublicGroup(e.target.checked)}
                className="mr-2"
                id="publicGroup"
              />
              <label htmlFor="publicGroup">
                Public Group (visible to everyone)
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded-md"
                onClick={() => setIsCreatingGroup(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={handleCreateGroup}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add User to Group</h3>

            <div className="mb-4">
              <label className="block mb-2 font-medium">User Email</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter user's email"
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the email address of the user you want to add
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded-md"
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserEmail("");
                }}
                disabled={isAddingUser}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                onClick={handleAddUserToGroup}
                disabled={isAddingUser}
              >
                {isAddingUser ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  "Add User"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
