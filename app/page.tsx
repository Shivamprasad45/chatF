// "use client";
// import axios from "axios";
// import { useRouter } from "next/navigation";
// import { useEffect, useRef, useState } from "react";
// import io from "socket.io-client";

// const socket = io("http://localhost:5000");

// interface Group {
//   _id: string;
//   name: string;
//   admin: string;
//   members: string[];
//   isPublic: boolean;
// }

// interface Message {
//   _id: string;
//   sender: string;
//   text: string;
//   senderName: string;
//   groupId?: string;
// }

// export default function ChatPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<{ name: string; _id: string } | null>(null);
//   const [activeTab, setActiveTab] = useState<"myGroups" | "publicGroups">(
//     "myGroups"
//   );
//   const [groups, setGroups] = useState<Group[]>([]);
//   const [publicGroups, setPublicGroups] = useState<Group[]>([]);
//   const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
//   const [message, setMessage] = useState("");
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isCreatingGroup, setIsCreatingGroup] = useState(false);
//   const [newGroupName, setNewGroupName] = useState("");
//   const [isPublicGroup, setIsPublicGroup] = useState(true);
//   const messagesEndRef = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     const userData = sessionStorage.getItem("token");
//     if (!userData) {
//       router.push("/login");
//     } else {
//       const parsedUser = JSON.parse(userData);
//       setUser(parsedUser);
//       fetchGroups(parsedUser._id);
//       fetchPublicGroups();
//     }
//   }, []);

//   useEffect(() => {
//     if (selectedGroup) {
//       fetchGroupMessages(selectedGroup._id);
//       joinGroupRoom(selectedGroup._id);
//     }

//     return () => {
//       if (selectedGroup) {
//         socket.emit("leave-group", selectedGroup._id);
//       }
//     };
//   }, [selectedGroup]);

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   const fetchGroups = async (userId: string) => {
//     try {
//       const response = await axios.get(
//         `http://localhost:5000/api/groups/user/${userId}`
//       );
//       setGroups(response.data);
//     } catch (error) {
//       console.error("Error fetching groups:", error);
//     }
//   };

//   const fetchPublicGroups = async () => {
//     try {
//       const response = await axios.get(
//         "http://localhost:5000/api/groups/public"
//       );
//       setPublicGroups(response.data);
//     } catch (error) {
//       console.error("Error fetching public groups:", error);
//     }
//   };

//   const fetchGroupMessages = async (groupId: string) => {
//     try {
//       const response = await axios.get(
//         `http://localhost:5000/api/messages/group/${groupId}`
//       );
//       setMessages(response.data);
//     } catch (error) {
//       console.error("Error fetching messages:", error);
//     }
//   };

//   const joinGroupRoom = (groupId: string) => {
//     socket.emit("join-group", groupId);
//     socket.on("group-message", (newMessage: Message) => {
//       if (newMessage.groupId === groupId) {
//         setMessages((prev) => [...prev, newMessage]);
//       }
//     });
//   };

//   const handleCreateGroup = async () => {
//     if (!newGroupName.trim() || !user) return;
//     console.log(user);
//     try {
//       const response = await axios.post(
//         "http://localhost:5000/api/groups/create",
//         {
//           name: newGroupName,
//           isPublic: isPublicGroup,
//           admin: user._id,
//           members: [user._id],
//         }
//       );

//       setGroups((prev) => [...prev, response.data]);
//       setIsCreatingGroup(false);
//       setNewGroupName("");
//     } catch (error) {
//       console.error("Error creating group:", error);
//     }
//   };

//   const joinGroup = async (groupId: string) => {
//     if (!user) return;

//     try {
//       await axios.post("http://localhost:5000/api/groups/join", {
//         groupId,
//         userId: user._id,
//       });

//       // Update groups list
//       fetchGroups(user._id);

//       // If joining the current group, update selected group info
//       if (selectedGroup && selectedGroup._id === groupId) {
//         setSelectedGroup((prev) =>
//           prev ? { ...prev, members: [...prev.members, user._id] } : null
//         );
//       }
//     } catch (error) {
//       console.error("Error joining group:", error);
//     }
//   };

//   const sendMessage = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!message.trim() || !user || !selectedGroup) return;

//     // Check if user is member (required to send messages)
//     if (!selectedGroup.members.includes(user._id)) {
//       alert("You must join the group to send messages");
//       return;
//     }

//     const newMessage = {
//       sender: user._id,
//       text: message,
//       groupId: selectedGroup._id,
//       senderName: user.name,
//     };

//     try {
//       // Send message to server
//       await axios.post("http://localhost:5000/api/messages/send", newMessage);

//       // Optimistically update UI
//       // setMessages((prev) => [
//       //   ...prev,
//       //   {
//       //     ...newMessage,
//       //     _id: Date.now().toString(), // temporary ID
//       //   },
//       // ]);

//       setMessage("");
//     } catch (error) {
//       console.error("Error sending message:", error);
//     }
//   };

//   const isGroupMember = (group: Group) => {
//     return user && group.members.includes(user._id);
//   };

//   return (
//     <main className="flex h-screen bg-gray-100">
//       {/* Sidebar */}
//       <div className="w-64 bg-white shadow-md flex flex-col">
//         <div className="p-4 text-xl font-bold border-b">BChat</div>

//         {/* Tabs */}
//         <div className="flex border-b">
//           <button
//             className={`flex-1 py-2 font-medium ${
//               activeTab === "myGroups" ? "bg-gray-200" : ""
//             }`}
//             onClick={() => setActiveTab("myGroups")}
//           >
//             My Groups
//           </button>
//           <button
//             className={`flex-1 py-2 font-medium ${
//               activeTab === "publicGroups" ? "bg-gray-200" : ""
//             }`}
//             onClick={() => setActiveTab("publicGroups")}
//           >
//             Public Groups
//           </button>
//         </div>

//         {/* Group List */}
//         <div className="flex-1 overflow-y-auto p-2">
//           {activeTab === "myGroups"
//             ? groups.map((group) => (
//                 <div
//                   key={group._id}
//                   className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
//                     selectedGroup?._id === group._id ? "bg-blue-100" : ""
//                   }`}
//                   onClick={() => setSelectedGroup(group)}
//                 >
//                   <div className="font-medium">{group.name}</div>
//                   <div className="text-xs text-gray-500">
//                     {group.isPublic ? "Public" : "Private"} •{" "}
//                     {group.members.length} members
//                   </div>
//                 </div>
//               ))
//             : publicGroups.map((group) => (
//                 <div
//                   key={group._id}
//                   className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
//                     selectedGroup?._id === group._id ? "bg-blue-100" : ""
//                   }`}
//                   onClick={() => setSelectedGroup(group)}
//                 >
//                   <div className="flex justify-between items-center">
//                     <div>
//                       <div className="font-medium">{group.name}</div>
//                       <div className="text-xs text-gray-500">
//                         {group.members.length} members
//                       </div>
//                     </div>
//                     {!isGroupMember(group) && (
//                       <button
//                         className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           joinGroup(group._id);
//                         }}
//                       >
//                         Join
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               ))}
//         </div>

//         {/* Create Group Button */}
//         <button
//           className="m-4 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
//           onClick={() => setIsCreatingGroup(true)}
//         >
//           Create Group
//         </button>
//       </div>

//       {/* Main Chat Area */}
//       <div className="flex-1 flex flex-col">
//         {selectedGroup ? (
//           <>
//             <div className="p-4 bg-white border-b">
//               <div className="flex justify-between items-center">
//                 <div>
//                   <div className="font-bold text-xl">{selectedGroup.name}</div>
//                   <div className="text-sm text-gray-600">
//                     {selectedGroup.isPublic ? "Public Group" : "Private Group"}{" "}
//                     •{isGroupMember(selectedGroup) ? " Member" : " Non-member"}
//                   </div>
//                 </div>
//                 {!isGroupMember(selectedGroup) && (
//                   <button
//                     className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
//                     onClick={() => joinGroup(selectedGroup._id)}
//                   >
//                     Join Group
//                   </button>
//                 )}
//               </div>
//             </div>

//             <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
//               {messages.map((msg) => (
//                 <div
//                   key={msg._id}
//                   className={`p-3 rounded-lg mb-3 max-w-[80%] ${
//                     msg.sender === user?._id
//                       ? "bg-green-100 ml-auto"
//                       : "bg-white"
//                   }`}
//                 >
//                   <div className="font-medium text-sm">
//                     {msg.sender === user?._id ? "You" : msg.senderName}
//                   </div>
//                   <div>{msg.text}</div>
//                 </div>
//               ))}
//               <div ref={messagesEndRef} />
//             </div>

//             {isGroupMember(selectedGroup) ? (
//               <form
//                 onSubmit={sendMessage}
//                 className="flex p-4 border-t bg-white"
//               >
//                 <input
//                   type="text"
//                   value={message}
//                   onChange={(e) => setMessage(e.target.value)}
//                   placeholder="Type a message..."
//                   className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none"
//                 />
//                 <button
//                   type="submit"
//                   className="px-4 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700"
//                 >
//                   Send
//                 </button>
//               </form>
//             ) : (
//               <div className="p-4 text-center bg-yellow-50 text-gray-600">
//                 You must join the group to send messages
//               </div>
//             )}
//           </>
//         ) : (
//           <div className="flex-1 flex items-center justify-center bg-gray-50">
//             <div className="text-center p-8 bg-white rounded-lg shadow">
//               <h2 className="text-2xl font-bold mb-4">Welcome to BChat</h2>
//               <p className="text-gray-600 mb-6">
//                 {activeTab === "myGroups"
//                   ? "You're not in any groups yet. Create or join a group to start chatting!"
//                   : "Browse public groups and join conversations"}
//               </p>
//               <button
//                 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
//                 onClick={() => setIsCreatingGroup(true)}
//               >
//                 Create New Group
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Create Group Modal */}
//       {isCreatingGroup && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
//           <div className="bg-white rounded-lg p-6 w-full max-w-md">
//             <h3 className="text-xl font-bold mb-4">Create New Group</h3>
//             <div className="mb-4">
//               <label className="block mb-2 font-medium">Group Name</label>
//               <input
//                 type="text"
//                 value={newGroupName}
//                 onChange={(e) => setNewGroupName(e.target.value)}
//                 placeholder="Enter group name"
//                 className="w-full px-3 py-2 border rounded-md"
//               />
//             </div>
//             <div className="mb-4 flex items-center">
//               <input
//                 type="checkbox"
//                 checked={isPublicGroup}
//                 onChange={(e) => setIsPublicGroup(e.target.checked)}
//                 className="mr-2"
//                 id="publicGroup"
//               />
//               <label htmlFor="publicGroup">
//                 Public Group (visible to everyone)
//               </label>
//             </div>
//             <div className="flex justify-end gap-2">
//               <button
//                 className="px-4 py-2 border rounded-md"
//                 onClick={() => setIsCreatingGroup(false)}
//               >
//                 Cancel
//               </button>
//               <button
//                 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
//                 onClick={handleCreateGroup}
//               >
//                 Create
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </main>
//   );
// }
import React from "react";
import ChatPage from "./chat/page";

const page = () => {
  return (
    <div>
      <ChatPage />
    </div>
  );
};

export default page;
