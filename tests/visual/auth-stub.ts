export const supabase = {
  auth: {
    signOut: async () => {
      throw new Error("Autenticação real desativada nesta prévia");
    },
  },
};
