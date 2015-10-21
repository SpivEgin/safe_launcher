// Copyright 2015 MaidSafe.net limited.
//
// This SAFE Network Software is licensed to you under (1) the MaidSafe.net Commercial License,
// version 1.0 or later, or (2) The General Public License (GPL), version 3, depending on which
// licence you accepted on initial access to the Software (the "Licences").
//
// By contributing code to the SAFE Network Software, or to this project generally, you agree to be
// bound by the terms of the MaidSafe Contributor Agreement, version 1.0.  This, along with the
// Licenses can be found in the root directory of this project at LICENSE, COPYING and CONTRIBUTOR.
//
// Unless required by applicable law or agreed to in writing, the SAFE Network Software distributed
// under the GPL Licence is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.
//
// Please review the Licences for the specific language governing permissions and limitations
// relating to use of the SAFE Network Software.

#[derive(RustcDecodable, Debug)]
pub struct CreateFile {
    is_shared   : bool,
    file_path  : String,
    user_metadata : String,
}

impl ::launcher::parser::traits::Action for CreateFile {
    fn execute(&mut self, params: ::launcher::parser::ParameterPacket) -> ::launcher::parser::ResponseType {
        use rustc_serialize::base64::FromBase64;
        
        if self.is_shared && !*eval_result!(params.safe_drive_access.lock()) {
            return Err(::errors::LauncherError::PermissionDenied)
        };

        let start_dir_key = if self.is_shared {
            &params.safe_drive_dir_key
        } else {
            &params.app_root_dir_key
        };

        let mut tokens = ::launcher::parser::helper::tokenise_path(&self.file_path, false);
        let mut file_directory = try!(::launcher::parser::helper::get_final_subdirectory(params.client.clone(),
                                                                                        &tokens,
                                                                                        Some(start_dir_key)));

        let file_helper = ::safe_nfs::helper::file_helper::FileHelper::new(params.client);

        let file_name = eval_option!(self.file_path.split('/').last(),"Failed to get file name.").to_string(); 
        let bin_metadata = try!(parse_result!(self.user_metadata.from_base64(), "Failed Converting from Base64."));

        let _ = try!(file_helper.create(file_name,
                                        bin_metadata,
                                        file_directory));

        Ok(None)
    }
}
