class AddGoogleUidToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :google_uid, :string
    add_index :users, :google_uid, unique: true
  end
  
  def down
    remove_index :users, :google_uid if index_exists?(:users, :google_uid)
    remove_column :users, :google_uid if column_exists?(:users, :google_uid)
  end
end
