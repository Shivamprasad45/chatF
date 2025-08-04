import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

interface Group {
  _id: string;
  name: string;
  admin: string;
  members: string[];
  isPublic: boolean;
}

interface Message {
  _id: string;
  sender: string;
  text: string;
  senderName: string;
  groupId?: string;
  fileUrl?: string;
  fileType?: "image" | "video" | "document" | "audio";
  timestamp: Date;
}

export interface SignedUrlResponse {
  signedUrl: string;
  fileUrl: string;
}
export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({ baseUrl: "https://chatdist.vercel.app/api" }),
  tagTypes: ["Groups", "Messages", "Members"],
  endpoints: (builder) => ({
    getSignedUrl: builder.query<
      SignedUrlResponse,
      { fileName: string; fileType: string }
    >({
      query: ({ fileName, fileType }) => ({
        url: "/upload/signed-url",
        params: { fileName, fileType },
      }),
    }),
    getUserGroups: builder.query<Group[], string>({
      query: (userId) => `/groups/user/${userId}`,
      providesTags: ["Groups"],
    }),
    getPublicGroups: builder.query<Group[], void>({
      query: () => "/groups/public",
      providesTags: ["Groups"],
    }),
    getGroupMessages: builder.query<Message[], string>({
      query: (groupId) => `/messages/group/${groupId}`,
      providesTags: (result, error, groupId) => [
        { type: "Messages", id: groupId },
      ],
    }),
    createGroup: builder.mutation<
      Group,
      { name: string; isPublic: boolean; admin: string; members: string[] }
    >({
      query: (body) => ({
        url: "/groups/create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    joinGroup: builder.mutation<Group, { groupId: string; userId: string }>({
      query: (body) => ({
        url: "/groups/join",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    getGroupMembers: builder.query<string[], string>({
      query: (groupId) => `/groups/${groupId}/members`,
      providesTags: (result, error, groupId) => [
        { type: "Members", id: groupId },
      ],
    }),
    // New endpoint: Add user to group (admin only)
    addUserToGroup: builder.mutation<
      Group,
      { groupId: string; userId: string; adminId: string }
    >({
      query: ({ groupId, userId, adminId }) => ({
        url: `/groups/${groupId}/members`,
        method: "POST",
        body: { userId, adminId },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: "Groups" },
        { type: "Members", id: arg.groupId },
      ],
    }),

    // New endpoint: Remove user from group (admin only)
    removeUserFromGroup: builder.mutation<
      Group,
      { groupId: string; userId: string; adminId: string }
    >({
      query: ({ groupId, userId, adminId }) => ({
        url: `/groups/${groupId}/members/${userId}`,
        method: "DELETE",
        body: { adminId: adminId },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: "Groups" },
        { type: "Members", id: arg.groupId },
      ],
    }),

    sendMessage: builder.mutation<
      Message,
      {
        sender: string;
        text: string;
        groupId: string;
        senderName: string;
        file?: {
          url: string;
          type: string;
        };
      }
    >({
      query: (body) => ({
        url: "/messages/send",
        method: "POST",
        body,
      }),
      async onQueryStarted({ groupId }, { dispatch, queryFulfilled }) {
        try {
          const { data: sentMessage } = await queryFulfilled;
          dispatch(
            chatApi.util.updateQueryData(
              "getGroupMessages",
              groupId,
              (draft) => {
                draft.push(sentMessage);
              }
            )
          );
        } catch {}
      },
    }),
  }),
});

export const {
  useGetUserGroupsQuery,
  useGetPublicGroupsQuery,
  useGetGroupMessagesQuery,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useSendMessageMutation,
  useGetGroupMembersQuery,
  useAddUserToGroupMutation,
  useRemoveUserFromGroupMutation,
  useGetSignedUrlQuery,
} = chatApi;
